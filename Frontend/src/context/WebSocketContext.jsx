import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { WS_URL } from '../services/api'

const WebSocketContext = createContext(null)

export function WebSocketProvider({ children }) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const listenersRef = useRef(new Set())
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef(null)

  const addListener = useCallback((fn) => {
    listenersRef.current.add(fn)
    return () => listenersRef.current.delete(fn)
  }, [])

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => {
          setConnected(true)
          retryCountRef.current = 0
        }

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.event_id) {
              listenersRef.current.forEach((fn) => fn(data))
            }
          } catch {
            // ignore non-JSON ping frames
          }
        }

        ws.onclose = () => {
          setConnected(false)
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
          retryCountRef.current += 1
          retryTimeoutRef.current = setTimeout(connect, delay)
        }

        ws.onerror = () => ws.close()
      } catch (e) {
        console.error('WS error:', e)
      }
    }

    connect()

    return () => {
      clearTimeout(retryTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{ connected, addListener }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWSListener(callback) {
  const ctx = useContext(WebSocketContext)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!ctx) return
    return ctx.addListener((data) => callbackRef.current(data))
  }, [ctx])
}

export function useWSConnected() {
  const ctx = useContext(WebSocketContext)
  return ctx?.connected ?? false
}
