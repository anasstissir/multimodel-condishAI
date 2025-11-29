import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set, get) => ({
      // Navigation
      currentView: 'upload', // 'upload' | 'checkin' | '3d-view' | 'inspection' | 'report'
      setCurrentView: (view) => set({ currentView: view }),
      
      // Project Mode
      inspectionMode: null, // 'checkin' | 'checkout'
      setInspectionMode: (mode) => set({ inspectionMode: mode }),
      
      // Lease Information
      leaseInfo: null, // Full lease data from document
      setLeaseInfo: (info) => set({ 
        leaseInfo: info,
        // Also set deposit if available
        depositAmount: info?.security_deposit?.amount || null,
        depositCurrency: info?.security_deposit?.currency || 'USD',
      }),
      
      // Deposit
      depositAmount: null,
      depositCurrency: 'USD',
      setDeposit: (amount, currency = 'USD') => set({ 
        depositAmount: amount, 
        depositCurrency: currency 
      }),
      
      // Deposit Deductions (calculated after inspection)
      depositDeductions: null,
      setDepositDeductions: (deductions) => set({ depositDeductions: deductions }),
      
      // Floor Plan
      floorPlanImage: null,
      floorPlanData: null,
      generated3DImage: null,
      setFloorPlanImage: (image) => set({ floorPlanImage: image }),
      setFloorPlanData: (data) => set({ floorPlanData: data }),
      setGenerated3DImage: (image) => set({ generated3DImage: image }),
      
      // Rooms
      rooms: [],
      selectedRoom: null,
      setRooms: (rooms) => set({ rooms }),
      selectRoom: (roomId) => {
        const rooms = get().rooms
        const room = rooms.find(r => r.id === roomId)
        set({ selectedRoom: room })
      },
      
      // Check-in Images (reference images per room)
      checkInImages: {}, // { roomId: { images: [base64], date: timestamp, notes: string } }
      
      setCheckInImages: (roomId, images, notes = '') => {
        const current = get().checkInImages
        set({
          checkInImages: {
            ...current,
            [roomId]: {
              images,
              date: Date.now(),
              notes,
            },
          },
        })
      },
      
      addCheckInImage: (roomId, image) => {
        const current = get().checkInImages
        const roomData = current[roomId] || { images: [], date: Date.now(), notes: '' }
        set({
          checkInImages: {
            ...current,
            [roomId]: {
              ...roomData,
              images: [...roomData.images, image],
              date: Date.now(),
            },
          },
        })
      },
      
      removeCheckInImage: (roomId, imageIndex) => {
        const current = get().checkInImages
        const roomData = current[roomId]
        if (!roomData) return
        
        const newImages = roomData.images.filter((_, i) => i !== imageIndex)
        set({
          checkInImages: {
            ...current,
            [roomId]: {
              ...roomData,
              images: newImages,
            },
          },
        })
      },
      
      getCheckInImagesForRoom: (roomId) => {
        const data = get().checkInImages[roomId]
        return data?.images || []
      },
      
      getRoomsWithCheckIn: () => {
        const checkIn = get().checkInImages
        return Object.keys(checkIn).filter(roomId => 
          checkIn[roomId]?.images?.length > 0
        )
      },
      
      // Check-in Progress
      checkInProgress: 0,
      updateCheckInProgress: () => {
        const rooms = get().rooms
        const checkInImages = get().checkInImages
        if (rooms.length === 0) return
        
        const roomsWithImages = rooms.filter(room => 
          checkInImages[room.id]?.images?.length > 0
        ).length
        
        set({ checkInProgress: (roomsWithImages / rooms.length) * 100 })
      },
      
      // Inspection
      inspectionProgress: 0,
      inspectedRooms: [],
      currentRoomIndex: 0,
      damages: [],
      
      startInspection: () => {
        const rooms = get().rooms
        if (rooms.length > 0) {
          set({ 
            currentView: 'inspection',
            selectedRoom: rooms[0],
            currentRoomIndex: 0,
            inspectedRooms: [],
            inspectionProgress: 0,
          })
        }
      },
      
      completeRoom: (roomId, newDamages = []) => {
        const { rooms, inspectedRooms, currentRoomIndex, damages: existingDamages } = get()
        const newInspected = [...inspectedRooms, roomId]
        const progress = (newInspected.length / rooms.length) * 100
        const nextIndex = currentRoomIndex + 1
        
        // Remove any existing damages for this room, then add new ones
        // This prevents duplicates when re-inspecting a room
        const filteredDamages = existingDamages.filter(d => d.roomId !== roomId)
        const updatedDamages = [...filteredDamages, ...newDamages]
        
        set({
          inspectedRooms: newInspected,
          inspectionProgress: progress,
          damages: updatedDamages,
          currentRoomIndex: nextIndex,
          selectedRoom: rooms[nextIndex] || null,
        })
        
        if (nextIndex >= rooms.length) {
          set({ currentView: 'report' })
        }
      },
      
      skipRoom: () => {
        const { rooms, currentRoomIndex } = get()
        const nextIndex = currentRoomIndex + 1
        set({
          currentRoomIndex: nextIndex,
          selectedRoom: rooms[nextIndex] || null,
        })
        
        if (nextIndex >= rooms.length) {
          set({ currentView: 'report' })
        }
      },
      
      addDamage: (damage) => {
        set({ damages: [...get().damages, damage] })
      },
      
      // Remove a specific damage by index
      removeDamage: (index) => {
        const damages = get().damages
        set({ damages: damages.filter((_, i) => i !== index) })
      },
      
      // Ignored damages (human override)
      ignoredDamages: [],
      
      ignoreDamage: (damage, reason = 'Not actual damage') => {
        const { damages, ignoredDamages } = get()
        // Remove from damages, add to ignored
        const updatedDamages = damages.filter(d => 
          !(d.type === damage.type && d.location === damage.location && d.roomId === damage.roomId)
        )
        set({
          damages: updatedDamages,
          ignoredDamages: [...ignoredDamages, { ...damage, ignoreReason: reason, ignoredAt: Date.now() }]
        })
      },
      
      restoreDamage: (index) => {
        const { damages, ignoredDamages } = get()
        const damageToRestore = ignoredDamages[index]
        if (!damageToRestore) return
        
        const { ignoreReason, ignoredAt, ...cleanDamage } = damageToRestore
        set({
          damages: [...damages, cleanDamage],
          ignoredDamages: ignoredDamages.filter((_, i) => i !== index)
        })
      },
      
      clearIgnoredDamages: () => set({ ignoredDamages: [] }),
      
      // Camera
      cameraStream: null,
      isAnalyzing: false,
      analysisResult: null,
      setCameraStream: (stream) => set({ cameraStream: stream }),
      setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
      setAnalysisResult: (result) => set({ analysisResult: result }),
      
      // Quote
      repairQuote: null,
      setRepairQuote: (quote) => set({ repairQuote: quote }),
      
      // Reset (keeps check-in images for future inspections)
      resetInspection: () => set({
        currentView: '3d-view',
        selectedRoom: null,
        inspectionProgress: 0,
        inspectedRooms: [],
        currentRoomIndex: 0,
        damages: [],
        analysisResult: null,
        repairQuote: null,
        depositDeductions: null,
      }),
      
      // Full Reset
      reset: () => set({
        currentView: 'upload',
        inspectionMode: null,
        leaseInfo: null,
        depositAmount: null,
        depositCurrency: 'USD',
        depositDeductions: null,
        floorPlanImage: null,
        floorPlanData: null,
        generated3DImage: null,
        rooms: [],
        selectedRoom: null,
        checkInImages: {},
        checkInProgress: 0,
        inspectionProgress: 0,
        inspectedRooms: [],
        currentRoomIndex: 0,
        damages: [],
        analysisResult: null,
        repairQuote: null,
      }),
    }),
    {
      name: 'condish-storage',
      // Don't persist images - they exceed localStorage quota
      // Only persist small metadata
      partialize: (state) => ({
        // Only persist small data
        rooms: state.rooms,
        depositAmount: state.depositAmount,
        depositCurrency: state.depositCurrency,
        inspectionMode: state.inspectionMode,
        // Don't persist: checkInImages (too large), floorPlanData, generated3DImage, leaseInfo
      }),
      // Handle storage errors gracefully
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('Storage hydration failed, clearing storage:', error)
          localStorage.removeItem('condish-storage')
        }
      },
    }
  )
)
