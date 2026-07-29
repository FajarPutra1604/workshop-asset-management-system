import { useState, useEffect } from 'react'
import client from '../api/client'

export function useConstants() {
  const [constants, setConstants] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchConstants() {
      try {
        const { data } = await client.get('/settings/constants')
        setConstants(data)
      } catch (e) {
        console.error('Failed to load constants:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchConstants()
  }, [])

  return { constants, loading, refetch: () => { setLoading(true); fetchConstants() } }
}
