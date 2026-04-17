The CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.
vite v5.4.21 building for production...
transforming...
✓ 2434 modules transformed.
rendering chunks...
computing gzip size...
dist/renderer/index.html                   0.97 kB │ gzip:   0.54 kB
dist/renderer/assets/index-CwDIztSa.css   25.76 kB │ gzip:   5.54 kB
dist/renderer/assets/index-ky_Tby4s.js   533.04 kB │ gzip: 135.01 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 4.50s
vite v5.4.21 building for production...
transforming...
✓ 400 modules transformed.
rendering chunks...
computing gzip size...
dist/main/main.js  655.61 kB │ gzip: 137.35 kB │ map: 1,274.63 kB
✓ built in 1.23s
vite v5.4.21 building for production...
transforming...
✓ 1 modules transformed.
rendering chunks...
computing gzip size...
dist/preload/preload.js  8.80 kB │ gzip: 1.65 kB │ map: 17.37 kB
✓ built in 18ms
  • electron-builder  version=25.1.8 os=10.0.26100
  • artifacts will be published  reason=tag is defined tag=v1.0.0
  • loaded configuration  file=package.json ("build" field)
  • @electron/rebuild already used by electron-builder, please consider to remove excess dependency from devDependencies

To ensure your native dependencies are always matched electron version, simply add script `"postinstall": "electron-builder install-app-deps" to your `package.json`
  • executing @electron/rebuild  electronVersion=32.3.3 arch=x64 buildFromSource=false appDir=./
  • installing native dependencies  arch=x64
  • preparing       moduleName=better-sqlite3 arch=x64
  • finished        moduleName=better-sqlite3 arch=x64
  • completed installing native dependencies
  • packaging       platform=win32 arch=x64 electron=32.3.3 appOutDir=release\win-unpacked
  • downloading     url=https://github.com/electron/electron/releases/download/v32.3.3/electron-v32.3.3-win32-x64.zip size=113 MB parts=8
  • downloaded      url=https://github.com/electron/electron/releases/download/v32.3.3/electron-v32.3.3-win32-x64.zip duration=1.525s
  • updating asar integrity executable resource  executablePath=release\win-unpacked\Luma App.exe
  • default Electron icon is used  reason=application icon is not set
  • downloading     url=https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z size=5.6 MB parts=1
  • downloaded      url=https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z duration=540ms
  • signing with signtool.exe  path=release\win-unpacked\Luma App.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • building        target=nsis file=release\Luma App Setup 1.0.0.exe archs=x64 oneClick=false perMachine=false
  • downloading     url=https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z size=1.3 MB parts=1
  • downloaded      url=https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z duration=391ms
  • signing with signtool.exe  path=release\win-unpacked\resources\elevate.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • downloading     url=https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-resources-3.4.1/nsis-resources-3.4.1.7z size=731 kB parts=1
  • downloaded      url=https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-resources-3.4.1/nsis-resources-3.4.1.7z duration=451ms
  • signing with signtool.exe  path=release\__uninstaller-nsis-luma-app.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=release\Luma App Setup 1.0.0.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • building block map  blockMapFile=release\Luma App Setup 1.0.0.exe.blockmap
  • publishing      publisher=Github (owner: schecko0, project: Luma-app, version: 1.0.0)
  • uploading       file=Luma-App-Setup-1.0.0.exe.blockmap provider=github
  • uploading       file=Luma-App-Setup-1.0.0.exe provider=github
  • creating GitHub release  reason=release doesn't exist tag=v1.0.0 version=1.0.0
  ⨯ Cannot cleanup: 

Error #1 --------------------------------------------------------------------------------
HttpError: 403 Forbidden
"method: post url: https://api.github.com/repos/schecko0/Luma-app/releases\n\n          Data:\n          {\"message\":\"Resource not accessible by integration\",\"documentation_url\":\"https://docs.github.com/rest/releases/releases#create-a-release\",\"status\":\"403\"}\n          "
Headers: {
  "date": "Fri, 17 Apr 2026 19:24:23 GMT",
  "content-type": "application/json; charset=utf-8",
  "content-length": "153",
  "x-github-media-type": "github.v3; format=json",
  "x-accepted-github-permissions": "contents=write; contents=write,workflows=write",
  "x-github-api-version-selected": "2022-11-28",
  "access-control-expose-headers": "ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset",
  "access-control-allow-origin": "*",
  "strict-transport-security": "max-age=31536000; includeSubdomains; preload",
  "x-frame-options": "deny",
  "x-content-type-options": "nosniff",
  "x-xss-protection": "0",
  "referrer-policy": "origin-when-cross-origin, strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'none'",
  "vary": "Accept-Encoding, Accept, X-Requested-With",
  "x-github-request-id": "2008:3E60E7:28E5ECE:A3A893E:69E288E7",
  "server": "github.com",
  "x-ratelimit-limit": "5000",
  "x-ratelimit-remaining": "4998",
  "x-ratelimit-reset": "1776457463",
  "x-ratelimit-used": "2",
  "x-ratelimit-resource": "core"
}
    at createHttpError (D:\a\Luma-app\Luma-app\node_modules\builder-util-runtime\src\httpExecutor.ts:30:10)
    at IncomingMessage.<anonymous> (D:\a\Luma-app\Luma-app\node_modules\builder-util-runtime\src\httpExecutor.ts:201:13)
    at IncomingMessage.emit (node:events:536:35)
    at endReadableNT (node:internal/streams/readable:1698:12)
    at processTicksAndRejections (node:internal/process/task_queues:82:21)

Error #2 --------------------------------------------------------------------------------
HttpError: 403 Forbidden
"method: post url: https://api.github.com/repos/schecko0/Luma-app/releases\n\n          Data:\n          {\"message\":\"Resource not accessible by integration\",\"documentation_url\":\"https://docs.github.com/rest/releases/releases#create-a-release\",\"status\":\"403\"}\n          "
Headers: {
  "date": "Fri, 17 Apr 2026 19:24:23 GMT",
  "content-type": "application/json; charset=utf-8",
  "content-length": "153",
  "x-github-media-type": "github.v3; format=json",
  "x-accepted-github-permissions": "contents=write; contents=write,workflows=write",
  "x-github-api-version-selected": "2022-11-28",
  "access-control-expose-headers": "ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset",
  "access-control-allow-origin": "*",
  "strict-transport-security": "max-age=31536000; includeSubdomains; preload",
  "x-frame-options": "deny",
  "x-content-type-options": "nosniff",
  "x-xss-protection": "0",
  "referrer-policy": "origin-when-cross-origin, strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'none'",
  "vary": "Accept-Encoding, Accept, X-Requested-With",
  "x-github-request-id": "2008:3E60E7:28E5ECE:A3A893E:69E288E7",
  "server": "github.com",
  "x-ratelimit-limit": "5000",
  "x-ratelimit-remaining": "4998",
  "x-ratelimit-reset": "1776457463",
  "x-ratelimit-used": "2",
  "x-ratelimit-resource": "core"
}
    at createHttpError (D:\a\Luma-app\Luma-app\node_modules\builder-util-runtime\src\httpExecutor.ts:30:10)
    at IncomingMessage.<anonymous> (D:\a\Luma-app\Luma-app\node_modules\builder-util-runtime\src\httpExecutor.ts:201:13)
    at IncomingMessage.emit (node:events:536:35)
    at endReadableNT (node:internal/streams/readable:1698:12)
    at processTicksAndRejections (node:internal/process/task_queues:82:21)  failedTask=build stackTrace=Error: Cannot cleanup: 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        Error #1 --------------------------------------------------------------------------------
HttpError: 403 Forbidden
"method: post url: https://api.github.com/repos/schecko0/Luma-app/releases\n\n          Data:\n          {\"message\":\"Resource not accessible by integration\",\"documentation_url\":\"https://docs.github.com/rest/releases/releases#create-a-release\",\"status\":\"403\"}\n          "
Headers: {
  "date": "Fri, 17 Apr 2026 19:24:23 GMT",
  "content-type": "application/json; charset=utf-8",
  "content-length": "153",
  "x-github-media-type": "github.v3; format=json",
  "x-accepted-github-permissions": "contents=write; contents=write,workflows=write",
  "x-github-api-version-selected": "2022-11-28",
  "access-control-expose-headers": "ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset",
  "access-control-allow-origin": "*",
  "strict-transport-security": "max-age=31536000; includeSubdomains; preload",
  "x-frame-options": "deny",
  "x-content-type-options": "nosniff",
  "x-xss-protection": "0",
  "referrer-policy": "origin-when-cross-origin, strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'none'",
  "vary": "Accept-Encoding, Accept, X-Requested-With",
  "x-github-request-id": "2008:3E60E7:28E5ECE:A3A893E:69E288E7",
  "server": "github.com",
  "x-ratelimit-limit": "5000",
  "x-ratelimit-remaining": "4998",
  "x-ratelimit-reset": "1776457463",
  "x-ratelimit-used": "2",
  "x-ratelimit-resource": "core"
}
    at createHttpError (D:\a\Luma-app\Luma-app\node_modules\builder-util-runtime\src\httpExecutor.ts:30:10)
    at IncomingMessage.<anonymous> (D:\a\Luma-app\Luma-app\node_modules\builder-util-runtime\src\httpExecutor.ts:201:13)
    at IncomingMessage.emit (node:events:536:35)
    at endReadableNT (node:internal/streams/readable:1698:12)
    at processTicksAndRejections (node:internal/process/task_queues:82:21)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        Error #2 --------------------------------------------------------------------------------
HttpError: 403 Forbidden
"method: post url: https://api.github.com/repos/schecko0/Luma-app/releases\n\n          Data:\n          {\"message\":\"Resource not accessible by integration\",\"documentation_url\":\"https://docs.github.com/rest/releases/releases#create-a-release\",\"status\":\"403\"}\n          "
Headers: {
  "date": "Fri, 17 Apr 2026 19:24:23 GMT",
  "content-type": "application/json; charset=utf-8",
  "content-length": "153",
  "x-github-media-type": "github.v3; format=json",
  "x-accepted-github-permissions": "contents=write; contents=write,workflows=write",
  "x-github-api-version-selected": "2022-11-28",
  "access-control-expose-headers": "ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset",
  "access-control-allow-origin": "*",
  "strict-transport-security": "max-age=31536000; includeSubdomains; preload",
  "x-frame-options": "deny",
  "x-content-type-options": "nosniff",
  "x-xss-protection": "0",
  "referrer-policy": "origin-when-cross-origin, strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'none'",
  "vary": "Accept-Encoding, Accept, X-Requested-With",
  "x-github-request-id": "2008:3E60E7:28E5ECE:A3A893E:69E288E7",
  "server": "github.com",
  "x-ratelimit-limit": "5000",
  "x-ratelimit-remaining": "4998",
  "x-ratelimit-reset": "1776457463",
  "x-ratelimit-used": "2",
  "x-ratelimit-resource": "core"
}
    at createHttpError (D:\a\Luma-app\Luma-app\node_modules\builder-util-runtime\src\httpExecutor.ts:30:10)
    at IncomingMessage.<anonymous> (D:\a\Luma-app\Luma-app\node_modules\builder-util-runtime\src\httpExecutor.ts:201:13)
    at IncomingMessage.emit (node:events:536:35)
    at endReadableNT (node:internal/streams/readable:1698:12)
    at processTicksAndRejections (node:internal/process/task_queues:82:21)
    at throwError (D:\a\Luma-app\Luma-app\node_modules\builder-util\src\asyncTaskManager.ts:88:11)
    at checkErrors (D:\a\Luma-app\Luma-app\node_modules\builder-util\src\asyncTaskManager.ts:53:9)
    at AsyncTaskManager.awaitTasks (D:\a\Luma-app\Luma-app\node_modules\builder-util\src\asyncTaskManager.ts:67:7)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at PublishManager.awaitTasks (D:\a\Luma-app\Luma-app\node_modules\app-builder-lib\src\publish\PublishManager.ts:235:5)
    at executeFinally (D:\a\Luma-app\Luma-app\node_modules\builder-util\src\promise.ts:23:3)