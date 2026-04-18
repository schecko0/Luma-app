# Guía de Actualizaciones Automáticas — Luma App

Esta guía detalla el flujo de trabajo para implementar y mantener el sistema de auto-actualización usando **GitHub Releases** y **electron-updater**.

## 1. Arquitectura del Sistema
El sistema se basa en tres pilares:
1. **Librería `electron-updater`**: Reside en el proceso principal (`main.ts`) y consulta GitHub cada vez que la app arranca.
2. **GitHub Releases**: Repositorio en la nube donde se alojan los instaladores (`.exe`, `.dmg`) y un archivo llamado `latest.yml` que contiene la versión más nueva.
3. **GitHub Actions**: Un robot que compila el código y sube los archivos a GitHub por ti cuando detecta un "Tag" (ej: `v1.0.1`).

## 2. Implementación en el Código

### A. Proceso Principal (Main)
Se debe importar `autoUpdater` de `electron-updater`. 
- `autoUpdater.checkForUpdatesAndNotify()`: Es el comando básico que busca, descarga e instala silenciosamente al cerrar la app.
- Eventos opcionales: `update-available`, `download-progress`, `update-downloaded`.

### B. Configuración del `package.json`
Es vital definir el "provider" en la sección `build`:
```json
"build": {
  "publish": [
    {
      "provider": "github",
      "owner": "tu-usuario-github",
      "repo": "Luma-app"
    }
  ]
}
```

## 3. Flujo de Trabajo para Publicar una Versión
Cuando quieras lanzar una actualización, los pasos son:

1. **Subir versión**: Cambia la versión en el `package.json` (ej: de `1.0.0` a `1.1.0`).
  2. **Tag de Git**:
    ```bash
    # 1. Actualiza package.json
    "version": "1.0.5"

    # 2. Commit + push + tag
    git add .
    git commit -m "feat: ocultar menu bar en produccion"
    git push origin main
    git tag v1.0.16
    git push origin v1.0.16
   ```
3. **Automatización**: GitHub Actions detectará el tag, compilará la app y creará un "Draft Release" en GitHub.
4. **Publicar**: Entras a GitHub, revisas que los archivos estén ahí y le das a "Publish Release".

## 4. Ventajas para WhatsApp
Si `whatsapp-web.js` falla:
1. Actualizas la librería en tu código local: `npm update whatsapp-web.js`.
2. Haces el push con el nuevo tag de versión.
3. En 5-10 minutos, todos tus usuarios recibirán una notificación en sus computadoras diciendo que hay una actualización disponible. Al reiniciar la app, el error de WhatsApp estará corregido sin que el usuario hiciera nada manual.

---
> Documento generado el 17 de abril de 2026 para el proyecto Luma-app.
