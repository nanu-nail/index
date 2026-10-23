import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db, firebaseConfigured } from './firebase'

async function getActiveCollection (name) {
  if (!firebaseConfigured) return []
  const request = query(collection(db, name), where('active', '==', true), orderBy('sortOrder'))
  const result = await getDocs(request)
  return result.docs.map(item => ({ id: item.id, ...item.data() }))
}

export function getServices () {
  return getActiveCollection('services')
}

export function getPortfolioWorks () {
  return getActiveCollection('portfolios')
}
