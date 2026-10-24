# 𝚗𝚊𝚗𝚞.｜美甲預約網站

以 Vue 2.7、Vue CLI、Vue Router 3、Firebase Authentication 與 Cloud Firestore 建置。前端可部署至 GitHub Pages；GitHub Pages 不承載 Firebase 機密或資料庫規則。

## 本機預覽

1. 安裝 Node.js 16 或更新的 LTS 版本及 Git。
2. 在專案目錄執行 `npm install`。
3. 複製 `.env.example` 為 `.env`，填入 Firebase Web App 設定值。
4. 執行 `npm run dev`，再開啟終端機顯示的本機網址（通常為 `http://localhost:8080`）。

Firebase 設定尚未完成時仍可預覽首頁；登入與即時預約需先設定 Firebase。

## Firebase 初次設定

1. 在 Firebase Console 建立專案及 Web App，記下 Web App 的設定值。
2. Authentication → Sign-in method：啟用 Google，設定支援的聯絡信箱。
3. Authentication → Settings → Authorized domains：加入 `localhost` 與部署網域（例如 `你的帳號.github.io`）。
4. 建立 Cloud Firestore 資料庫。設定後在本機 `.env` 填入 `.env.example` 中的六個 `VUE_APP_FIREBASE_*` 值。
5. 使用 Firebase CLI 登入後，從專案目錄執行 `firebase use --add` 選擇正確專案，再執行 `firebase deploy --only firestore:rules,firestore:indexes`。
6. 在 GitHub Repository → Settings → Secrets and variables → Actions → Variables，新增六個同名 `VUE_APP_FIREBASE_*` 專案 Variables。Firebase Web API key 是供瀏覽器初始化 SDK 的識別值，不是管理員金鑰；Firestore Rules 才負責資料存取保護。

Firestore 資料集合由管理介面逐步建立：`users`（會員）、`services`（服務）、`portfolios`（作品）、`businessSettings/booking`（營業規則）、`blockedDates`（公休日）、`bookings`（預約），以及 `scheduleDays`（每日預約時段鎖）。預約保留服務名稱、價格和時長快照。第一階段美甲師使用固定 ID `primary`，時段互斥以同一日期文件的 Firestore 交易維護。

## 安全設定管理員

管理員身分使用 Firebase Authentication 自訂宣告 `admin: true`，不使用可由會員自行編輯的 Firestore 欄位。請在自己的受信任 Google Cloud Shell 工作階段中，以具備 Firebase Authentication 管理權限的帳號執行以下指令；將專案 ID、店家 Google 電子郵件換成實際值：

```sh
mkdir -p ~/nanu-admin-setup && cd ~/nanu-admin-setup
npm init -y
npm install firebase-admin
cat > set-admin.cjs <<'EOF'
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')

initializeApp({ credential: applicationDefault(), projectId: '替換成 Firebase 專案 ID' })
getAuth().getUserByEmail('替換成店家 Google 電子郵件')
  .then(user => getAuth().setCustomUserClaims(user.uid, { ...user.customClaims, admin: true }))
  .then(() => console.log('管理員權限已設定。請登出並重新登入網站。'))
  .catch(error => { console.error(error); process.exitCode = 1 })
EOF
node set-admin.cjs
```

先讓該 Google 帳號登入過一次，Firebase Authentication 才會有使用者紀錄。Cloud Shell 執行者需要 Firebase Authentication 管理權限；若 ADC 無法使用，先執行 `gcloud auth application-default login`。不要把服務帳戶金鑰下載或提交到此專案。撤銷權限時，讀取該帳號目前的 `customClaims`、移除其中的 `admin` 欄位，再將剩餘宣告傳給 `setCustomUserClaims`，以免覆蓋其他既有宣告。

## GitHub Pages 部署

1. 在 GitHub 建立名稱為 `nanu-nail` 的 Repository，將本專案推送到 `main` 分支。`vue.config.js` 已設定專案子路徑 `/nanu-nail/`，Vue Router 使用 hash 模式。
2. 在 Repository 的 Actions Variables 填好前述 Firebase Web App 設定。
3. Repository → Settings → Pages → Build and deployment，將 Source 設為 **GitHub Actions**。
4. 推送到 `main` 或手動執行 Actions 的 **Build and deploy to GitHub Pages** 工作流程。部署完成後，到 Actions 的部署工作頁查看網站網址。
5. 將 `帳號.github.io` 加入 Firebase Authentication 授權網域。

此工作流程使用 `npm ci`，因此請一併提交 `package-lock.json`。本機 `main` 分支已初始化；建立 GitHub Repository 後，在專案 PowerShell 以實際網址設定 remote 並推送：

```powershell
git remote add origin https://github.com/你的GitHub帳號/nanu-nail.git
git add .
git commit -m "Build nail booking site"
git push -u origin main
```

## 預約與管理行為

- 預設營業時間 10:00–19:00；每小時提供開始時間選項，服務必須在營業時間內完成。
- 同一位美甲師的預約開始時間至少相隔 4 小時。顧客載入時先看到當下空檔，送出時再由 Firestore 交易重查，避免兩位顧客搶到同日衝突時段。
- 顧客需 Google 登入才能建立預約；預約初始狀態為「待確認」，顧客不能取消或修改狀態，僅管理員可確認、取消或完成。
- 不收訂金。更完整的店家政策、品牌資訊、正式作品圖片及服務價格尚待店家提供。
- 管理員頁面路徑為 `/#/admin`。初次登入管理者後可新增服務及作品、設定營業時間與公休日。

## 目前需要店家補上的資料

品牌正式名稱與介紹、聯絡方式、社群網址、服務項目與價格、款式分類、營業日（目前只設定每日時段）、取消及遲到政策、作品授權圖片。以上沒有資料的項目不應當作正式營業資訊對外宣稱。
