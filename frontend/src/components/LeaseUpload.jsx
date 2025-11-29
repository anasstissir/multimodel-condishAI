import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  Upload, 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  CheckCircle,
  Building,
  Calendar,
  DollarSign,
  Home,
  AlertCircle
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { processLeaseDocument, generate3DFromDocument } from '../api/client'

export default function LeaseUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [step, setStep] = useState('upload') // 'upload' | 'analyzing' | 'extracting' | 'generating' | 'ready'
  const [leaseFile, setLeaseFile] = useState(null)
  const [error, setError] = useState(null)
  
  const { 
    setLeaseInfo,
    setFloorPlanData,
    setGenerated3DImage,
    setRooms,
    setCurrentView,
    setInspectionMode,
    inspectionMode,
  } = useStore()

  const handleFile = useCallback(async (file) => {
    if (!file) return
    
    // Check file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF or image file')
      return
    }
    
    setLeaseFile(file)
    setError(null)
    setIsProcessing(true)
    setStep('analyzing')
    
    try {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1]
        const mimeType = file.type
        
        try {
          // Step 1: Process lease document (extract info + find floor plan)
          setStep('analyzing')
          const leaseResult = await processLeaseDocument(base64, mimeType)
          
          if (leaseResult.lease_info) {
            setLeaseInfo(leaseResult.lease_info)
          }
          
          // Step 2: Generate 3D from document if floor plan found
          if (leaseResult.floor_plan?.floor_plan_found || leaseResult.ready_for_inspection) {
            setStep('generating')
            
            const result3D = await generate3DFromDocument(base64, mimeType)
            
            if (result3D.status === 'success') {
              if (result3D.floor_plan) {
                setFloorPlanData(result3D.floor_plan)
                setRooms(result3D.floor_plan?.rooms || [])
              }
              
              if (result3D.image_3d?.image_base64) {
                setGenerated3DImage(result3D.image_3d.image_base64)
              }
              
              setStep('ready')
              
              // Auto-navigate based on mode
              setTimeout(() => {
                if (inspectionMode === 'checkin') {
                  setCurrentView('checkin')
                } else {
                  setCurrentView('3d-view')
                }
              }, 1500)
            } else {
              setError('Could not generate 3D visualization. Please try uploading a floor plan separately.')
              setStep('upload')
            }
          } else {
            // No floor plan found - inform user
            setError('No floor plan found in document. Lease info was extracted. You can upload a floor plan separately.')
            setStep('upload')
          }
          
        } catch (err) {
          console.error('Processing error:', err)
          setError(err.message || 'Failed to process document')
          setStep('upload')
        } finally {
          setIsProcessing(false)
        }
      }
      
      reader.readAsDataURL(file)
      
    } catch (err) {
      console.error('File read error:', err)
      setError('Failed to read file')
      setIsProcessing(false)
      setStep('upload')
    }
  }, [inspectionMode])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  return (
    <div className="lease-upload-container">
      <motion.div 
        className="upload-hero"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div 
          className="hero-badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <FileText size={16} />
          <span>Lease Document AI</span>
        </motion.div>
        
        <h1 className="hero-title">
          Upload Your
          <br />
          <span className="gradient-text">Lease Document</span>
        </h1>
        
        <p className="hero-subtitle">
          Our AI will extract the floor plan, deposit info, and property details automatically
        </p>
      </motion.div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div 
            className="error-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Zone */}
      <motion.div 
        className={`upload-zone lease-zone ${isDragging ? 'dragging' : ''} ${leaseFile ? 'has-file' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !isProcessing && document.getElementById('lease-input').click()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        whileHover={{ scale: isProcessing ? 1 : 1.02 }}
      >
        <input
          id="lease-input"
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => handleFile(e.target.files[0])}
          hidden
        />
        
        <AnimatePresence mode="wait">
          {!leaseFile && step === 'upload' && (
            <motion.div 
              className="upload-placeholder"
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="upload-icon lease-icon">
                <FileText size={48} />
              </div>
              <h3>Drop your lease document here</h3>
              <p>or click to browse</p>
              <div className="upload-formats">
                Supports PDF and images (JPG, PNG)
              </div>
            </motion.div>
          )}
          
          {(leaseFile || isProcessing) && (
            <motion.div 
              className="processing-display"
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {leaseFile && (
                <div className="file-info">
                  <FileText size={32} />
                  <span className="file-name">{leaseFile.name}</span>
                </div>
              )}
              
              <div className="processing-steps">
                <AnimatePresence mode="wait">
                  {step === 'analyzing' && (
                    <motion.div 
                      key="analyzing"
                      className="processing-step"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Loader2 className="spin" size={28} />
                      <span>Analyzing lease document...</span>
                      <p>Extracting deposit, terms, and property info</p>
                    </motion.div>
                  )}
                  
                  {step === 'extracting' && (
                    <motion.div 
                      key="extracting"
                      className="processing-step"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Home className="pulse" size={28} />
                      <span>Finding floor plan...</span>
                      <p>Identifying property layout</p>
                    </motion.div>
                  )}
                  
                  {step === 'generating' && (
                    <motion.div 
                      key="generating"
                      className="processing-step"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Sparkles className="pulse" size={28} />
                      <span>Generating 3D visualization...</span>
                      <p>Creating beautiful home render</p>
                    </motion.div>
                  )}
                  
                  {step === 'ready' && (
                    <motion.div 
                      key="ready"
                      className="processing-step success"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <CheckCircle size={48} />
                      <span>Document Processed!</span>
                      <p>Ready for inspection</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* What We Extract */}
      <motion.div 
        className="extraction-info"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <h3>What we extract from your lease:</h3>
        <div className="extraction-grid">
          <div className="extraction-item">
            <div className="extraction-icon">
              <Home size={20} />
            </div>
            <div className="extraction-text">
              <span>Floor Plan</span>
              <p>Property layout & rooms</p>
            </div>
          </div>
          
          <div className="extraction-item">
            <div className="extraction-icon">
              <DollarSign size={20} />
            </div>
            <div className="extraction-text">
              <span>Security Deposit</span>
              <p>Amount & conditions</p>
            </div>
          </div>
          
          <div className="extraction-item">
            <div className="extraction-icon">
              <Calendar size={20} />
            </div>
            <div className="extraction-text">
              <span>Lease Terms</span>
              <p>Dates & responsibilities</p>
            </div>
          </div>
          
          <div className="extraction-item">
            <div className="extraction-icon">
              <Building size={20} />
            </div>
            <div className="extraction-text">
              <span>Property Details</span>
              <p>Bedrooms, amenities, etc.</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Or Upload Floor Plan Separately */}
      <motion.div 
        className="alternative-upload"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <span className="divider-text">or upload floor plan separately</span>
        <button 
          className="alt-upload-btn"
          onClick={() => {
            setLeaseFile(null)
            setStep('upload')
            // The FloorPlanUpload component handles this
          }}
        >
          <Upload size={16} />
          Upload Floor Plan Only
        </button>
      </motion.div>
    </div>
  )
}

