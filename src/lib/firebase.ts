import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

export const firebaseConfig = {
  apiKey: 'AIzaSyDQalZ85kvvdo2rUQQ2LuCFpNYnpjbhSEk',
  authDomain: 'estudainte-uide.firebaseapp.com',
  projectId: 'estudainte-uide',
  storageBucket: 'estudainte-uide.firebasestorage.app',
  messagingSenderId: '146886027326',
  appId: '1:146886027326:web:bc9bdcbc2bfd19b8d6496f',
  measurementId: 'G-NFDNN7X3LW',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
