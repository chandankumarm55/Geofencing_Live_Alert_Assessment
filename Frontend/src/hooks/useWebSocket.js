import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_URL } from '../services/api'

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const retryTimeout = useRef(null)

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setRetryCount(0)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.event_id && onMessage) {
            onMessage(data)
          }
        } catch (e) {
          // ignore ping frames
        }
      }

      ws.onclose = () => {
        setConnected(false)
        // Reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
        retryTimeout.current = setTimeout(() => {
          setRetryCount((c) => c + 1)
          connect()
        }, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch (e) {
      console.error('WS connection error:', e)
    }
  }, [onMessage, retryCount])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(retryTimeout.current)
      wsRef.current?.close()
    }
  }, [])

  return { connected }
}
