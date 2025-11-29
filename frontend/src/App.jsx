import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './components/Header'
import FloorPlanUpload from './components/FloorPlanUpload'
import CheckInManager from './components/CheckInManager'
import FloorPlan3DViewer from './components/FloorPlan3DViewer'
import InspectionPanel from './components/InspectionPanel'
import CameraInspection from './components/CameraInspection'
import DamageReport from './components/DamageReport'
import { useStore } from './store/useStore'
import './styles/App.css'

function App() {
  const { 
    currentView, 
    inspectionProgress 
  } = useStore()

  // Clear old/corrupted storage on initial load
  useEffect(() => {
    // Remove old storage key if exists
    localStorage.removeItem('damagevision-storage')
    
    try {
      const stored = localStorage.getItem('condish-storage')
      if (stored) {
        const data = JSON.parse(stored)
        // Check if stored data is too large (contains base64 images)
        if (JSON.stringify(data).length > 1000000) { // 1MB limit
          console.warn('Storage too large, clearing...')
          localStorage.removeItem('condish-storage')
          window.location.reload()
        }
      }
    } catch (e) {
      console.warn('Storage error, clearing:', e)
      localStorage.removeItem('condish-storage')
    }
  }, [])

  return (
    <div className="app">
      {/* Animated Background */}
      <div className="bg-grid" />
      <div className="bg-glow glow-1" />
      <div className="bg-glow glow-2" />
      <div className="bg-particles" />
      
      <Header />
      
      <main className="main-content">
        <AnimatePresence mode="wait">
          {currentView === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="view-container"
            >
              <FloorPlanUpload />
            </motion.div>
          )}
          
          {currentView === 'checkin' && (
            <motion.div
              key="checkin"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
              className="view-container full-width"
            >
              <CheckInManager />
            </motion.div>
          )}
          
          {currentView === '3d-view' && (
            <motion.div
              key="3d-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="view-container split-view"
            >
              <FloorPlan3DViewer />
              <InspectionPanel />
            </motion.div>
          )}
          
          {currentView === 'inspection' && (
            <motion.div
              key="inspection"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
              className="view-container split-view"
            >
              <CameraInspection />
              <InspectionPanel />
            </motion.div>
          )}
          
          {currentView === 'report' && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="view-container"
            >
              <DamageReport />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Progress Bar */}
      {inspectionProgress > 0 && (
        <motion.div 
          className="global-progress"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: inspectionProgress / 100 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </div>
  )
}

export default App
