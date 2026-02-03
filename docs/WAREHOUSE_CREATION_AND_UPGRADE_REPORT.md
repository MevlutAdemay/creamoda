# Yeni Warehouse Oluşturma ve Upgrade Yapısı – Detaylı Rapor

Bu rapor, **yeni WAREHOUSE oluşturma** akışında kullanılan API’leri, veritabanı işlemlerini ve ilgili tabloları adım adım açıklar. **Warehouse upgrade** (ör. Level 1 → Level 2) için aynı yapının nasıl kullanılacağı da özetlenir.

---

## 1. API’ler ve Rolü

| API | Metod | Amaç |
|-----|--------|------|
| **GET /api/player/warehouse/new/preview** | GET | Yeni depo eklemeden önce maliyet ve ihtiyaç önizlemesi (personel, ekipman, setup maliyeti, cüzdan bakiyesi). |
| **POST /api/player/warehouse/new/process** | POST | Yeni depoyu gerçekten oluşturur; tek transaction içinde bina, metrikler, personel, ekipman ve ödemeleri yazar. |

**Wizard akışı (AddWarehouseWizard):**  
Kullanıcı ülke + şehir + market zone seçer → Preview API ile maliyet/personel/ekipman görür → Onaylarsa Process API çağrılır.

---

## 2. Preview API – Detaylı İşlemler

**Dosya:** `app/api/player/warehouse/new/preview/route.ts`

**Query parametreleri:** `countryId`, `marketZone` (zorunlu).

### 2.1 Yapılan kontroller ve okumalar

| Sıra | İşlem | Tablo / Kaynak | Açıklama |
|------|--------|-----------------|----------|
| 1 | Auth | Session | `getServerSession()` → userId |
| 2 | Şirket | Company | `findFirst({ where: { playerId: userId } })` → companyId |
| 3 | Çakışma | CompanyBuilding | Aynı company + role=WAREHOUSE + aynı marketZone var mı? Varsa 409 |
| 4 | Ülke | Country | countryId ile name, salaryMultiplier |
| 5 | Personel kuralları | **StaffingRule** | `buildingRole=WAREHOUSE`, `level=1` → departmentCode, roleCode, roleName, roleStyle, deltaHeadcount, baseMonthlySalary |
| 6 | Ekipman kuralları | **RequirementRule** + **RequirementEquipment** + **EquipmentCatalog** | `buildingRole=WAREHOUSE`, `level=1` → her kural için equipmentRequirements → equipment (code, name, purchaseCostMoney), requiredQuantity |
| 7 | Setup maliyeti | **EconomyConfig** (getBuildingSetupCosts) | `buildingRole=WAREHOUSE`, `level=1` → metricType, upgradeCostMoney, awardXpOnUpgrade |
| 8 | Cüzdan | PlayerWallet | userId → balanceUsd |

### 2.2 Hesaplanan çıktılar

- **staff:** Her StaffingRule satırından bir pozisyon: departmentCode, roleCode, roleName, roleStyle, headcount (= deltaHeadcount), monthlySalary (= baseMonthlySalary × country.salaryMultiplier).
- **equipment:** RequirementRule’lardan toplanan ekipman listesi (code, name, quantity, unitCost, totalCost). Aynı code birden fazla kuralda geçiyorsa quantity en büyük değer alınır.
- **setupCosts:** EconomyConfig’te upgradeCostMoney > 0 olan her metricType için bir satır (metricType, cost, description).
- **costs:** equipmentTotal, setupTotal, totalSetupCost, monthlyPayroll.
- **wallet:** currentBalance, afterSetup (= currentBalance - totalSetupCost).

**Önemli:** Preview sadece **okuma** yapar; hiçbir tabloya yazılmaz.

---

## 3. Process API – Transaction İçi İşlem Sırası

**Dosya:** `app/api/player/warehouse/new/process/route.ts`

**Body:** `{ countryId, cityId, marketZone }` (zorunlu).

Tüm aşağıdaki adımlar **tek `prisma.$transaction`** içinde (timeout 60 sn) çalışır.

### 3.1 Ön kontroller (transaction dışı)

- Session → userId.
- Company (playerId = userId) → companyId.
- Aynı company + WAREHOUSE + marketZone ile mevcut bina var mı? → Varsa 409.
- Country (countryId) → iso2, salaryMultiplier.
- City (cityId) ve city.countryId === countryId kontrolü.
- dayKey = getCompanyGameDayKey(companyId).

### 3.2 Transaction içi sıra

#### Adım 1: Bina oluşturma

**Modül:** `createWarehouseBuilding(tx, { companyId, countryId, marketZone })`  
**Dosya:** `lib/company/create-warehouse-building.ts`

| Tablo | İşlem | Alanlar |
|-------|--------|---------|
| **CompanyBuilding** | create | companyId, countryId, role=WAREHOUSE, marketZone, name=(verilmişse yoksa `"Warehouse - {marketZone}"`) |

Çıktı: Oluşturulan `building` (id, companyId, countryId, role, marketZone, name, …).

---

#### Adım 2: Metrik durumlarını başlatma

**Modül:** `initBuildingMetrics(tx, building)`  
**Dosya:** `lib/buildings/init-building-metrics.ts`

| Sıra | Okuma | Yazma |
|------|--------|--------|
| 1 | **MetricLevelConfig:** buildingRole, level=1 → metricType, effects | — |
| 2 | **EconomyConfig:** buildingRole, level=1, metricType in list → areaM2, rentPerMonthly, overheadMonthly | — |
| 3 | — | **BuildingMetricState:** Her metricType için upsert (buildingId, metricType, currentLevel=1, currentCount=0, areaM2, rentPerMonthly, overheadMonthly, lastEvaluatedAt=null) |

Böylece deponun her metrik tipi (STOCK_COUNT, SALES_COUNT, EMPLOYEE_COUNT vb.) için Level 1 başlangıç satırı oluşturulur.

---

#### Adım 3: Setup maliyetleri (EconomyConfig – CAPEX)

**Fonksiyon:** `postWarehouseSetupCosts(tx, { companyId, buildingId, dayKey })`

| Tablo | İşlem | Açıklama |
|-------|--------|----------|
| **EconomyConfig** | Okuma | getBuildingSetupCosts(tx, WAREHOUSE) → buildingRole=WAREHOUSE, level=1 → metricType, upgradeCostMoney |
| **CompanyLedgerEntry** | create | Her metricType için (upgradeCostMoney > 0 ise): direction=OUT, amountUsd=upgradeCostMoney, category=CAPEX, scopeType=BUILDING, scopeId=buildingId, refType=WAREHOUSE_SETUP, refId=buildingId, idempotencyKey=WAREHOUSE_NEW:SETUP:{companyId}:{buildingId}:{metricType} |

Ledger’a yazılan tutarlar daha sonra toplu cüzdan güncellemesinde kullanılır (Adım 7).

---

#### Adım 4: Personel atama

**Fonksiyon:** `assignStaffForBuilding(tx, { userId, companyId, building, countryCode, salaryMultiplier, dayKey })`

| Sıra | Tablo/Kaynak | İşlem | Açıklama |
|------|----------------|--------|----------|
| 1 | **StaffingRule** | Okuma | buildingRole=WAREHOUSE, level=1 → departmentCode, roleCode, roleName, roleStyle, deltaHeadcount, baseMonthlySalary, metricType |
| 2 | **CompanyStaff** | count | Mevcut building’de aynı metricType, level=1, roleCode için kaç kişi var? |
| 3 | **CompanyStaff** | create | Eksik sayı kadar (needed = deltaHeadcount - existingCount): fullName (getSeededStaffName veya "John/Jane Doe"), gender (hash ile deterministik), departmentCode, roleCode, roleName, roleStyle, baseMonthlySalary, salaryMultiplierApplied, monthlySalaryFinal, hiredAt=dayKey. buildingId = yeni depo id. |
| 4 | **BuildingMetricState** | upsert | metricType=EMPLOYEE_COUNT: currentCount = building’deki aktif (firedAt=null) personel sayısı, lastEvaluatedAt=now |

Personel maaşları bu adımda **ledger’a yazılmaz**; sadece staff kayıtları ve EMPLOYEE_COUNT metrik güncellemesi yapılır (aylık maaş muhtemelen başka bir mekanizma ile ödeniyor).

---

#### Adım 5: Ekipman atama ve ekipman CAPEX

**Fonksiyon:** `assignEquipmentForBuilding(tx, { companyId, buildingId, dayKey })`

| Sıra | Tablo | İşlem | Açıklama |
|------|--------|--------|----------|
| 1 | **RequirementRule** + **RequirementEquipment** + **EquipmentCatalog** | Okuma | buildingRole=WAREHOUSE, level=1 → requiredQuantity, equipment (id, code, name, purchaseCostMoney) |
| 2 | **CompanyEquipment** | upsert | companyId + equipmentId → quantity = requiredQuantity (aynı ekipman birden fazla kuralda geçiyorsa max quantity), isActive=true |
| 3 | **CompanyLedgerEntry** | create | Her ekipman için (purchaseCostMoney × quantity > 0 ise): direction=OUT, category=CAPEX, scopeType=COMPANY, refType=WAREHOUSE_EQUIPMENT, refId=equipmentId, idempotencyKey=WAREHOUSE_NEW:CAPEX:{companyId}:{buildingId}:{code} |

Ekipman şirket bazlı (CompanyEquipment); bina bazlı değil. Yani ekipman “şirketin” olur, depo kurulumunda sadece gereken miktar eklenir/güncellenir.

---

#### Adım 6: Cüzdan güncellemesi (USD)

**Fonksiyon:** `updateWalletUsdFromLedgerBatch(tx, userId, allLedgerEntries)`

- Adım 3 ve 5’te oluşturulan **CompanyLedgerEntry** kayıtları toplanır.
- Sadece **yeni** oluşturulan (isNew=true) kayıtların tutarları toplanır; OUT yönü için negatif delta uygulanır.
- **PlayerWallet:** balanceUsd += toplam delta.

Böylece setup maliyetleri ve ekipman alımı tek seferde cüzdandan düşülmüş olur.

---

### 3.3 Process API’de yazılan / güncellenen tablolar özeti

| Tablo | İşlem | Not |
|-------|--------|-----|
| CompanyBuilding | create | 1 yeni depo |
| BuildingMetricState | upsert | MetricLevelConfig’teki her metricType için 1 satır (level 1, count 0); sonra EMPLOYEE_COUNT güncellenir |
| CompanyLedgerEntry | create | Setup (EconomyConfig) + ekipman CAPEX |
| CompanyStaff | create | StaffingRule’a göre eksik sayıda personel |
| CompanyEquipment | upsert | RequirementRule’a göre ekipman miktarları |
| PlayerWallet | update | balanceUsd azalır |

---

## 4. Upgrade (Level 1 → Level 2) için Kullanılacak Yapı

Upgrade’da da aynı **kavramsal** adımlar kullanılır; fark sadece **level=2** ve **mevcut bina** ile çalışmaktır.

### 4.1 Kullanılacak tablolar ve level

| Amaç | Tablo / Kaynak | Yeni depo (level 1) | Upgrade (level 2) |
|------|----------------|----------------------|--------------------|
| Personel ihtiyacı | **StaffingRule** | buildingRole=WAREHOUSE, **level=1** | buildingRole=WAREHOUSE, **level=2** |
| Ekipman ihtiyacı | **RequirementRule** + **RequirementEquipment** | level=1 | **level=2** |
| Setup/upgrade maliyeti | **EconomyConfig** | level=1 (upgradeCostMoney) | **level=2** (upgradeCostMoney) |
| Seviye limitleri | **MetricLevelConfig** | level=1 → minRequired, maxAllowed | level=2 → minRequired, maxAllowed |
| Bina metrik durumu | **BuildingMetricState** | currentLevel=1, currentCount=0 | currentLevel **2**’ye güncellenir |

### 4.2 Upgrade akışı (mantıksal)

1. **Ön koşul:** İlgili deponun BuildingMetricState’lerinde (ör. STOCK_COUNT, SALES_COUNT) currentCount >= MetricLevelConfig(level=2).minRequired olmalı (ve isteğe bağlı diğer kurallar).
2. **Preview (upgrade):**  
   - StaffingRule(WAREHOUSE, **level=2**) → ek/delta personel sayısı ve maaş.  
   - RequirementRule(WAREHOUSE, **level=2**) → level 2 için ek ekipman (mevcut CompanyEquipment ile karşılaştırıp sadece **eksik** miktarlar).  
   - EconomyConfig(WAREHOUSE, **level=2**) → metricType bazlı upgrade maliyeti.  
   Toplam maliyet ve “after balance” hesaplanır.
3. **Process (upgrade):**  
   - **BuildingMetricState:** İlgili metricType’lar için currentLevel = 2, (isteğe bağlı) areaM2/rent/overhead EconomyConfig(level=2)’den güncellenir.  
   - **CompanyLedgerEntry:** EconomyConfig(level=2) upgradeCostMoney için OUT + idempotency (ör. WAREHOUSE_UPGRADE:…).  
   - **assignStaffForBuilding** benzeri: StaffingRule(level=**2**) ile **ek** personel (deltaHeadcount kadar) aynı building’e, level=2, metricType/roleCode ile create.  
   - **assignEquipmentForBuilding** benzeri: RequirementRule(level=**2**) ile **ek** ekipman miktarı CompanyEquipment’ta artırılır; ek CAPEX ledger’a yazılır.  
   - **PlayerWallet:** Tüm yeni ledger kayıtlarından toplu balanceUsd güncellemesi.  
   - (İsteğe bağlı) awardXpOnUpgrade varsa PlayerWalletTransaction + balanceXp.

### 4.3 Upgrade’da dikkat edilecekler

- **StaffingRule** ve **RequirementRule** level=2 için tanımlı olmalı (seed/migration).
- **EconomyConfig** ve **MetricLevelConfig** level=2 için dolu olmalı.
- Idempotency key’ler upgrade’a özel olmalı (ör. `WAREHOUSE_UPGRADE:{buildingId}:{metricType}:L2`) ki aynı upgrade tekrar çalıştırıldığında çift kesim olmasın.
- Ekipman: Level 2 kuralları level 1’in üzerinde ek miktar istiyorsa, mevcut CompanyEquipment.quantity ile kıyaslayıp sadece **fark** kadar alım ve CAPEX yazılmalı.

---

## 5. İlgili Prisma modelleri (referans)

| Model | Ana alanlar | Not |
|-------|-------------|-----|
| **CompanyBuilding** | id, companyId, countryId, role, marketZone, name | Depo = role WAREHOUSE. |
| **BuildingMetricState** | buildingId, metricType, currentLevel, currentCount, areaM2, rentPerMonthly, overheadMonthly, lastEvaluatedAt | Metrik bazlı seviye ve sayı. |
| **MetricLevelConfig** | buildingRole, metricType, level, minRequired, maxAllowed | Seviye limitleri (Development Stage’de kullanılıyor). |
| **EconomyConfig** | buildingRole, metricType, level, upgradeCostMoney, awardXpOnUpgrade, areaM2, rentPerMonthly, overheadMonthly | Level başına maliyet ve alan/kira/overhead. |
| **StaffingRule** | buildingRole, metricType, level, departmentCode, roleCode, roleName, roleStyle, deltaHeadcount, baseMonthlySalary | Level başına “bu rolde kaç kişi” ve maaş. |
| **CompanyStaff** | companyId, buildingId, metricType, level, departmentCode, roleCode, fullName, gender, monthlySalaryFinal, hiredAt, firedAt | Gerçek personel kayıtları. |
| **RequirementRule** | buildingRole, metricType, level | Level başına “bu metrik için ne gerekli”. |
| **RequirementEquipment** | ruleId, equipmentId, requiredQuantity | Kural–ekipman ilişkisi. |
| **EquipmentCatalog** | id, code, name, purchaseCostMoney, monthlyMaintenanceCost | Ekipman master. |
| **CompanyEquipment** | companyId, equipmentId, quantity, isActive | Şirketin sahip olduğu ekipman miktarı. |
| **CompanyLedgerEntry** | companyId, dayKey, direction, amountUsd, category, scopeType, scopeId, refType, refId, idempotencyKey | Tüm CAPEX/setup/upgrade ödemeleri. |
| **PlayerWallet** | userId, balanceUsd, balanceXp, balanceDiamond | Nihai bakiye güncellemesi. |

---

## 6. Özet

- **Yeni warehouse:**  
  Preview (personel + ekipman + setup maliyeti) → Process (bina + initBuildingMetrics + setup ledger + personel + ekipman + cüzdan) tek transaction’da.

- **Upgrade (L1 → L2):**  
  Aynı yapı kullanılır; veri kaynağı olarak **level=2** için StaffingRule, RequirementRule, EconomyConfig ve MetricLevelConfig kullanılır.  
  İşlemler: BuildingMetricState.currentLevel ve isteğe bağlı alanlar güncellenir, ek personel (CompanyStaff) ve ek ekipman (CompanyEquipment + ledger) eklenir, upgrade maliyeti ledger + cüzdan güncellenir.

Bu rapor, mevcut “yeni depo” akışının tam yapısını ve upgrade’da tekrarlanacak adımları tek yerde toplar; implementasyon detayları (idempotency key formatı, delta personel/ekipman hesaplama) kod tarafında bu akışa göre tamamlanabilir.
