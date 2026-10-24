import Vue from 'vue'
import {
  GoogleAuthProvider,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, firebaseConfigured } from './firebase'

export const authState = Vue.observable({
  loading: true,
  user: null,
  memberProfile: null,
  isAdmin: false,
  error: ''
})

let unsubscribeAuth = null
let observerStarted = false

async function loadMemberProfile (user) {
  const userRef = doc(db, 'users', user.uid)
  let current
  try {
    current = await getDoc(userRef)
  } catch (error) {
    throw profileOperationError(error, '讀取')
  }
  authState.memberProfile = current.exists() ? current.data() : null
}

export async function saveMemberProfile (user, customerName, phone) {
  if (!user || !user.uid) throw new Error('請先登入 Google 帳號。')
  const cleanName = String(customerName || '').trim()
  const cleanPhone = String(phone || '').trim()
  if (!cleanName) throw new Error('請輸入姓名。')
  if (!/^09\d{8}$/.test(cleanPhone)) throw new Error('請輸入有效的台灣手機號碼（09 開頭，共 10 碼）。')
  const userRef = doc(db, 'users', user.uid)
  try {
    const snapshot = await getDoc(userRef)
    if (snapshot.exists() && snapshot.data().customerName && snapshot.data().phone) {
      throw new Error('會員姓名與電話已綁定，無法再次修改。')
    }
    await setDoc(userRef, {
      uid: user.uid,
      customerName: cleanName,
      phone: cleanPhone,
      email: user.email || '',
      photoURL: user.photoURL || '',
      createdAt: snapshot.exists() ? snapshot.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true })
    authState.memberProfile = { uid: user.uid, customerName: cleanName, phone: cleanPhone, email: user.email || '', photoURL: user.photoURL || '' }
  } catch (error) {
    if (error.message === '會員姓名與電話已綁定，無法再次修改。') throw error
    throw profileOperationError(error, '儲存')
  }
}

function profileOperationError (error, operation) {
  const result = new Error(error && error.message ? error.message : 'Firestore 請求失敗')
  result.code = error && error.code ? error.code : ''
  result.profileOperation = operation
  return result
}

export function initializeAuth () {
  if (observerStarted) return unsubscribeAuth
  observerStarted = true

  if (!firebaseConfigured) {
    authState.loading = false
    return null
  }

  unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    authState.loading = true
    authState.user = user
    authState.isAdmin = false
    authState.error = ''

    try {
      if (user) {
        await loadMemberProfile(user)
        const token = await getIdTokenResult(user)
        authState.isAdmin = token.claims.admin === true
      } else {
        authState.memberProfile = null
      }
    } catch (error) {
      const errorCode = error && error.code ? `（${error.code}）` : ''
      const operation = error && error.profileOperation ? `${error.profileOperation}會員資料` : '取得登入權限'
      authState.error = `${operation}失敗${errorCode}，請檢查 Firestore 設定後重新整理。`
    } finally {
      authState.loading = false
    }
  }, () => {
    authState.user = null
    authState.memberProfile = null
    authState.isAdmin = false
    authState.loading = false
    authState.error = '無法確認登入狀態，請重新整理頁面。'
  })

  return unsubscribeAuth
}

export async function signInWithGoogle () {
  if (!firebaseConfigured) throw new Error('請先完成 Firebase 設定，再啟用 Google 登入。')
  authState.error = ''
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  try {
    const credential = await signInWithPopup(auth, provider)
    return credential.user
  } catch (error) {
    throw loginErrorMessage(error)
  }
}

function loginErrorMessage (error) {
  if (error.code === 'auth/popup-closed-by-user') return new Error('Google 登入視窗已關閉，尚未完成登入。')
  if (error.code === 'auth/popup-blocked') return new Error('瀏覽器封鎖了 Google 登入視窗，請允許彈出視窗後重試。')
  if (error.code === 'auth/cancelled-popup-request') return new Error('Google 登入已取消，請稍後再試。')
  if (error.code === 'auth/unauthorized-domain') return new Error('此網站網域尚未加入 Firebase 授權網域。')
  if (error.code === 'auth/operation-not-allowed') return new Error('Firebase 尚未啟用 Google 登入提供者。')
  if (error.code && (error.code.includes('api-key') || error.code.includes('identitytoolkit'))) {
    return new Error('Firebase Authentication 無法使用目前的 Web API Key。請確認它屬於 nanu-nail 專案，且 Identity Toolkit API 與 API 金鑰限制允許本機網站使用。')
  }
  if (error.code === 'auth/configuration-not-found' || error.code === 'auth/project-not-found') {
    return new Error('Firebase Authentication 專案設定尚未完成，請在 nanu-nail 專案確認已啟用 Authentication。')
  }
  return new Error('Google 登入失敗，請稍後重試。')
}

export async function signOutCurrentUser () {
  if (!auth) return
  authState.error = ''
  await signOut(auth)
}
