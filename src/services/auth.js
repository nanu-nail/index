import Vue from 'vue'
import {
  GoogleAuthProvider,
  getRedirectResult,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, firebaseConfigured } from './firebase'

export const authState = Vue.observable({
  loading: true,
  user: null,
  isAdmin: false,
  error: ''
})

let unsubscribeAuth = null
let observerStarted = false

async function saveMemberProfile (user) {
  const userRef = doc(db, 'users', user.uid)
  let current
  try {
    current = await getDoc(userRef)
  } catch (error) {
    throw profileOperationError(error, '讀取')
  }
  const profile = {
    uid: user.uid,
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    email: user.email || '',
    updatedAt: serverTimestamp()
  }

  try {
    if (current.exists()) {
      await setDoc(userRef, profile, { merge: true })
    } else {
      await setDoc(userRef, { ...profile, createdAt: serverTimestamp() })
    }
  } catch (error) {
    throw profileOperationError(error, current.exists() ? '更新' : '建立')
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

  getRedirectResult(auth).catch((error) => {
    authState.error = loginErrorMessage(error).message
  })

  unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    authState.user = user
    authState.isAdmin = false
    authState.error = ''

    try {
      if (user) {
        await saveMemberProfile(user)
        const token = await getIdTokenResult(user)
        authState.isAdmin = token.claims.admin === true
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
    await signInWithRedirect(auth, provider)
  } catch (error) {
    throw loginErrorMessage(error)
  }
}

function loginErrorMessage (error) {
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
