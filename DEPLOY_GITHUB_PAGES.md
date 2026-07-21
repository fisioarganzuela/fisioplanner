# Desplegar en GitHub Pages

Pasos, una sola vez:

## 1. Sube el código a GitHub
En Lovable: **GitHub → Connect** (o descarga el ZIP y sube el repo tú misma).

## 2. Activa Pages
En tu repo de GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 3. Añade los secretos
En tu repo → **Settings → Secrets and variables → Actions → New repository secret**. Crea estos tres (los valores están en el fichero `.env` de tu proyecto Lovable):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Son claves **publicables**, no privadas — es correcto usarlas en el frontend.

## 4. Configura la URL de redirección de Supabase
En el backend externo añade la URL pública de GitHub Pages a las URLs permitidas de autenticación, por ejemplo:
```
https://<tu-usuario>.github.io/<tu-repo>/**
```

Si el repositorio se llama exactamente `<tu-usuario>.github.io`, añade también:
```
https://<tu-usuario>.github.io/**
```

## 5. Empuja a `main`
El workflow `.github/workflows/deploy.yml` compila el sitio y lo publica automáticamente. La URL final aparece en la pestaña **Actions** al terminar el deploy.

## Notas
- Si publicas en un repo distinto de `<usuario>.github.io`, la app vivirá en un subpath (`/<repo>/`). Si algún enlace rompe, avísame y añado `base` al build.
- Cualquier `push` a `main` re-despliega.
- Alternativa más simple sin configurar nada: pulsa **Publish** arriba a la derecha en Lovable y tendrás una URL `.lovable.app` gratis y funcionando en segundos.
