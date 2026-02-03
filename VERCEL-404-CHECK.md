# Vercel 404 NOT_FOUND – Kontrol Listesi

Deploy başarılı ama **3 link de** (creamoda.vercel.app, git-main, deployment URL) 404 veriyorsa aşağıdakileri sırayla dene.

---

## 1. Root Directory (önemli)

**Senin repo: `MevlutAdemay/creamoda`** – yani repo kökü zaten Next.js projesi (package.json, app/ burada).

- **Root Directory mutlaka boş olmalı.**  
  Vercel → **Settings** → **General** → **Root Directory** → **Edit** → alanı **tamamen boş** bırak (veya `.`) → **Save**.
- Eğer Root Directory’de `creamoda` yazıyorsa **sil**. Repo içinde `creamoda` klasörü yok; Vercel yanlış yere bakıp 404 dönebilir.

Değiştirdiysen **Redeploy** et (Deployments → son deploy → ⋮ → Redeploy).

---

## 2. Framework "Other" görünüyorsa (404 nedeni)

Vercel bazen Framework’ü **Next.js** yerine **Other** kaydeder; Build Command boş kalır, site 404 verir.

**Yapman gerekenler:**

1. Vercel → **Settings** → **Build and Deployment**
2. **Framework** alanına tıkla (şu an "Other" yazıyor olabilir).
3. Açılan listeden **Next.js**’i seç (Create Next App / Next.js).
4. **Build Command** alanına yaz: `npm run build`  
   (Next.js seçince bazen otomatik dolmuyor; elle yaz.)
5. **Install Command** boş bırakabilirsin (varsayılan `npm install` kullanılır).
6. Sağ altta **Save**’e bas.
7. **Deployments** → son deployment → **Redeploy** yap.

Bundan sonra build Next.js olarak çalışır ve 404 büyük ihtimalle düzelir.

---

## 2. Hangi URL’i açıyorsun?

- **Production:** `https://<proje-adin>.vercel.app` (veya kendi domain’in)
- **Preview:** Her commit için farklı URL: `https://<proje>-xxx-<takim>.vercel.app`

Doğrudan **ana sayfayı** aç: `https://...vercel.app/` (sonunda `/` ile veya olmadan).  
Örn. `https://...vercel.app/player` yazıyorsan ve `/player` route’u yoksa 404 normal.

---

## 3. Framework ve build çıktısı

- **Framework Preset:** Vercel’da **Next.js** seçili olmalı (genelde otomatik algılanır).
- **Build Command:** `npm run build` veya boş (Next.js default).
- **Output Directory:** Boş bırak (Next.js kendi output’unu kullanır).

Deploy log’unda **“Build Completed”** ve **“Compiled successfully”** görüyorsan build tarafı tamam demektir.

---

## 4. Özet

| Durum | Yapılacak |
|--------|------------|
| Repo = tüm repo, Next.js = `creamoda/` içinde | Root Directory = `creamoda` yap, redeploy et |
| Root zaten `creamoda` | Açtığın URL’in tam olarak `https://...vercel.app/` olduğundan emin ol |
| Yine 404 | Vercel → Deployments → son deployment → **Visit** ile aç; hangi URL’de 404 aldığını not et |

Çoğu 404, **Root Directory**’nin `creamoda` yapılmamasından kaynaklanır.
