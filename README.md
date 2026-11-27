# Fintrack

Fintrack adalah pencatat keuangan personal untuk uang saku magang: pantau pemasukan dan pengeluaran bulanan, progres anggaran kos, dan tabungan sepanjang tahun. Aplikasi dibuat dengan Vue 3, TypeScript, Vite, Tailwind CSS v4, Pinia, Lucide, dan Supabase.

Tema warna secara default mengikuti preferensi sistem operasi. Tombol tema di dashboard dapat digunakan untuk memilih override terang/gelap atau kembali ke mode sistem.

## Jalankan secara lokal

```sh
npm install
npm run dev
```

Autentikasi Supabase wajib aktif. Tanpa kredensial Supabase, halaman utama tetap terkunci dan pengguna diarahkan ke halaman login.

## Aktifkan Supabase

1. Salin `.env.example` menjadi `.env.local`, lalu isi URL project dan publishable/anon key dari Supabase.
2. Jalankan SQL di `supabase/schema.sql` melalui Supabase SQL Editor.
3. Aktifkan Email/Password pada Authentication → Providers. Untuk alur pendaftaran tanpa konfirmasi, nonaktifkan Email Confirmations di pengaturan Auth; jika tetap aktif, pengguna perlu mengonfirmasi email sebelum masuk.
4. Jalankan ulang server Vite setelah mengubah environment variable.

Kredensial Supabase hanya menggunakan anon/publishable key di browser. Jangan pernah menaruh `service_role` key di aplikasi frontend. Kebijakan Row Level Security pada skema membatasi seluruh data ke pemilik akun masing-masing. Target anggaran awal dibuat otomatis saat pertama kali data bulan tersebut dimuat. Jika skema sudah dijalankan sebelumnya, jalankan kembali blok `GRANT` di bagian akhir `supabase/schema.sql` agar role `authenticated` mendapat hak akses API yang dibutuhkan.

## Perintah

- `npm run dev` — server pengembangan
- `npm run build` — type-check dan build produksi
- `npm run lint` — pemeriksaan lint
