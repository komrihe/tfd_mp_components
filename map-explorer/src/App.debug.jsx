export default function App() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#2563eb',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      fontWeight: 'bold',
      color: 'white',
      padding: '20px',
      textAlign: 'center',
      overflow: 'auto'
    }}>
      <div>✅ React is definitely working!</div>
      <div style={{fontSize: '16px', marginTop: '20px'}}>
        Current time: {new Date().toLocaleTimeString()}
      </div>
      <div style={{fontSize: '14px', marginTop: '20px', color: '#ccc'}}>
        If you see this, React rendering is functional.
      </div>
    </div>
  )
}
