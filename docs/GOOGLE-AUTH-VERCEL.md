# Google Auth'ı Vercel'da Çalıştırma

Localhost'ta çalışıyor ama `https://creamoda.vercel.app` üzerinden girişte hata alıyorsan aşağıdaki iki adımı tamamla.

---

## 1. Google Cloud Console – Redirect URI ekle

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Kullandığın **OAuth 2.0 Client ID**’ye tıkla (Web application).
3. **Authorized JavaScript origins** bölümüne ekle:
   - `https://creamoda.vercel.app`
   - (İstersen preview için: `https://*.vercel.app` – dikkatli kullan)
4. **Authorized redirect URIs** bölümüne ekle:
   - `https://creamoda.vercel.app/api/auth/google/callback`
5. **Save** ile kaydet.

Google, redirect URI’yi **tam olarak** eşleştirir. `http` / `https`, sonunda `/` olup olmaması fark yaratır; yukarıdaki satırı aynen kullan.

---

## 2. Vercel – Ortam değişkenleri

**Önemli:** Tarayıcıda doğrudan https://creamoda.vercel.app açıp (Production) Google ile giriş yapıyorsan bile **AUTH_ORIGIN** tanımlı olmalı. Vercel bazen sunucu tarafında farklı bir URL kullanabildiği için `redirect_uri_mismatch` alınabilir; `AUTH_ORIGIN` ile her zaman aynı adres kullanılır.

1. Vercel Dashboard → **creamoda** projesi → **Settings** → **Environment Variables**
2. Şunların **Production** (ve istersen Preview) için tanımlı olduğundan emin ol:
   - `GOOGLE_CLIENT_ID` = Google Console’daki Client ID
   - `GOOGLE_CLIENT_SECRET` = Google Console’daki Client secret
   - **`AUTH_ORIGIN`** = `https://creamoda.vercel.app` (sonunda `/` olmasın)
3. **Neden AUTH_ORIGIN?** Preview/PR deployment'lar farklı URL kullanır; `AUTH_ORIGIN` ile OAuth her zaman production URL'sine yönlenir.
4. **Redeploy şart:** Yeni eklediğin veya değiştirdiğin env değişkenleri ancak yeni bir deploy ile canlıya alınır. **Deployments** sekmesi → en üstteki (Production) deployment → sağ üst **⋯** → **Redeploy**.

---

## 3. Hâlâ hata alıyorsan

- Giriş sayfasında “Giriş yap” / Google ile girişe tıklayınca açılan **tam hata mesajını** veya **URL’deki `?error=...`** değerini not et.
- Tarayıcı geliştirici araçları (F12) → **Network** sekmesinde kırmızı olan isteğe tıkla; **Response** veya **Headers** kısmını kontrol et.
- Google Console’da **Credentials** sayfasında “Authorized redirect URIs” listesinde `https://creamoda.vercel.app/api/auth/google/callback` satırının **birebir** eşleştiğinden emin ol (ekstra boşluk, farklı path yok).

Bu adımlardan sonra `https://creamoda.vercel.app/api/auth/google/start` üzerinden akış çalışmalıdır.

**Not:** Projede `origin` Vercel’de `VERCEL_URL` ile sabitleniyor (Vercel bu değişkeni otomatik verir). Böylece `AUTH_ORIGIN` tanımlıysa OAuth hep bu origin kullanır; Production ve Preview tek URI ile çalışır.
