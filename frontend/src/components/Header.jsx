import { motion } from 'framer-motion'
import { Home, Box, Camera, FileText, RotateCcw, LogIn, LogOut, ImageIcon } from 'lucide-react'
import { useStore } from '../store/useStore'

const navItems = [
  { id: 'upload', icon: Home, label: 'Home' },
  { id: 'checkin', icon: ImageIcon, label: 'Check-In', onlyShow: ['checkin'] },
  { id: '3d-view', icon: Box, label: '3D View' },
  { id: 'inspection', icon: Camera, label: 'Inspect' },
  { id: 'report', icon: FileText, label: 'Report' },
]

export default function Header() {
  const { 
    currentView, 
    setCurrentView, 
    reset, 
    inspectionProgress,
    inspectionMode,
    checkInProgress,
  } = useStore()
  
  // Filter nav items based on mode
  const visibleNavItems = navItems.filter(item => {
    if (!item.onlyShow) return true
    return item.onlyShow.includes(currentView) || item.onlyShow.includes(inspectionMode)
  })
  
  return (
    <header className="header">
      <motion.div 
        className="logo"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="logo-icon">
          <span className="logo-emoji">🏠</span>
        </div>
        <div className="logo-text">
          <span className="logo-name">Condish<span className="logo-dot">.ai</span></span>
          <span className="logo-tag">Property Condition AI</span>
        </div>
      </motion.div>
      
      <nav className="nav">
        {visibleNavItems.map((item, index) => (
          <motion.button
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => setCurrentView(item.id)}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {currentView === item.id && (
              <motion.div 
                className="nav-indicator"
                layoutId="nav-indicator"
              />
            )}
          </motion.button>
        ))}
      </nav>
      
      <div className="header-actions">
        {/* Mode Badge */}
        {inspectionMode && (
          <motion.div 
            className={`mode-indicator ${inspectionMode}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {inspectionMode === 'checkin' ? (
              <>
                <LogIn size={14} />
                <span>Check-In</span>
              </>
            ) : (
              <>
                <LogOut size={14} />
                <span>Check-Out</span>
              </>
            )}
          </motion.div>
        )}
        
        {/* Progress */}
        {(inspectionProgress > 0 || (inspectionMode === 'checkin' && checkInProgress > 0)) && (
          <div className="progress-badge">
            <span>
              {inspectionMode === 'checkin' && currentView === 'checkin'
                ? `${Math.round(checkInProgress)}%`
                : `${Math.round(inspectionProgress)}%`
              }
            </span>
          </div>
        )}
        
        <motion.button 
          className="reset-btn"
          onClick={reset}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Reset All"
        >
          <RotateCcw size={18} />
        </motion.button>
      </div>
    </header>
  )
}
