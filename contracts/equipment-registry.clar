;; Equipment Registry Smart Contract
;; Manages agricultural research equipment verification and certification

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-exists (err u102))
(define-constant err-invalid-input (err u103))
(define-constant err-unauthorized (err u104))

;; Data Variables
(define-data-var next-equipment-id uint u1)

;; Data Maps
(define-map equipment-registry
  { equipment-id: uint }
  {
    name: (string-ascii 100),
    equipment-type: (string-ascii 50),
    manufacturer-year: uint,
    serial-number: (string-ascii 50),
    owner: principal,
    certified: bool,
    certification-date: uint,
    last-maintenance: uint,
    status: (string-ascii 20)
  }
)

(define-map equipment-by-serial
  { serial-number: (string-ascii 50) }
  { equipment-id: uint }
)

(define-map maintenance-records
  { equipment-id: uint, record-id: uint }
  {
    maintenance-date: uint,
    maintenance-type: (string-ascii 50),
    technician: principal,
    notes: (string-ascii 200)
  }
)

(define-map equipment-maintenance-count
  { equipment-id: uint }
  { count: uint }
)

;; Public Functions

;; Register new equipment
(define-public (register-equipment 
  (name (string-ascii 100))
  (equipment-type (string-ascii 50))
  (manufacturer-year uint)
  (serial-number (string-ascii 50)))
  (let
    (
      (equipment-id (var-get next-equipment-id))
    )
    ;; Check if serial number already exists
    (asserts! (is-none (map-get? equipment-by-serial { serial-number: serial-number })) err-already-exists)
    
    ;; Validate inputs
    (asserts! (> (len name) u0) err-invalid-input)
    (asserts! (> (len equipment-type) u0) err-invalid-input)
    (asserts! (> manufacturer-year u1900) err-invalid-input)
    (asserts! (> (len serial-number) u0) err-invalid-input)
    
    ;; Register equipment
    (map-set equipment-registry
      { equipment-id: equipment-id }
      {
        name: name,
        equipment-type: equipment-type,
        manufacturer-year: manufacturer-year,
        serial-number: serial-number,
        owner: tx-sender,
        certified: false,
        certification-date: u0,
        last-maintenance: u0,
        status: "registered"
      }
    )
    
    ;; Map serial number to equipment ID
    (map-set equipment-by-serial
      { serial-number: serial-number }
      { equipment-id: equipment-id }
    )
    
    ;; Initialize maintenance count
    (map-set equipment-maintenance-count
      { equipment-id: equipment-id }
      { count: u0 }
    )
    
    ;; Increment next equipment ID
    (var-set next-equipment-id (+ equipment-id u1))
    
    (ok equipment-id)
  )
)

;; Certify equipment (only contract owner)
(define-public (certify-equipment (equipment-id uint))
  (let
    (
      (equipment (unwrap! (map-get? equipment-registry { equipment-id: equipment-id }) err-not-found))
    )
    ;; Only contract owner can certify
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    
    ;; Update equipment certification
    (map-set equipment-registry
      { equipment-id: equipment-id }
      (merge equipment {
        certified: true,
        certification-date: stacks-block-height,
        status: "certified"
      })
    )
    
    (ok true)
  )
)

;; Add maintenance record
(define-public (add-maintenance-record
  (equipment-id uint)
  (maintenance-type (string-ascii 50))
  (notes (string-ascii 200)))
  (let
    (
      (equipment (unwrap! (map-get? equipment-registry { equipment-id: equipment-id }) err-not-found))
      (maintenance-count-data (default-to { count: u0 } (map-get? equipment-maintenance-count { equipment-id: equipment-id })))
      (record-id (get count maintenance-count-data))
    )
    ;; Only equipment owner can add maintenance records
    (asserts! (is-eq tx-sender (get owner equipment)) err-unauthorized)
    
    ;; Add maintenance record
    (map-set maintenance-records
      { equipment-id: equipment-id, record-id: record-id }
      {
        maintenance-date: stacks-block-height,
        maintenance-type: maintenance-type,
        technician: tx-sender,
        notes: notes
      }
    )
    
    ;; Update maintenance count
    (map-set equipment-maintenance-count
      { equipment-id: equipment-id }
      { count: (+ record-id u1) }
    )
    
    ;; Update last maintenance date
    (map-set equipment-registry
      { equipment-id: equipment-id }
      (merge equipment { last-maintenance: stacks-block-height })
    )
    
    (ok record-id)
  )
)

;; Transfer equipment ownership
(define-public (transfer-equipment (equipment-id uint) (new-owner principal))
  (let
    (
      (equipment (unwrap! (map-get? equipment-registry { equipment-id: equipment-id }) err-not-found))
    )
    ;; Only current owner can transfer
    (asserts! (is-eq tx-sender (get owner equipment)) err-unauthorized)
    
    ;; Update owner
    (map-set equipment-registry
      { equipment-id: equipment-id }
      (merge equipment { owner: new-owner })
    )
    
    (ok true)
  )
)

;; Read-only Functions

;; Get equipment information
(define-read-only (get-equipment-info (equipment-id uint))
  (map-get? equipment-registry { equipment-id: equipment-id })
)

;; Get equipment by serial number
(define-read-only (get-equipment-by-serial (serial-number (string-ascii 50)))
  (match (map-get? equipment-by-serial { serial-number: serial-number })
    equipment-data (map-get? equipment-registry { equipment-id: (get equipment-id equipment-data) })
    none
  )
)

;; Get maintenance record
(define-read-only (get-maintenance-record (equipment-id uint) (record-id uint))
  (map-get? maintenance-records { equipment-id: equipment-id, record-id: record-id })
)

;; Get maintenance count
(define-read-only (get-maintenance-count (equipment-id uint))
  (default-to { count: u0 } (map-get? equipment-maintenance-count { equipment-id: equipment-id }))
)

;; Check if equipment is certified
(define-read-only (is-equipment-certified (equipment-id uint))
  (match (map-get? equipment-registry { equipment-id: equipment-id })
    equipment (get certified equipment)
    false
  )
)

;; Get next equipment ID
(define-read-only (get-next-equipment-id)
  (var-get next-equipment-id)
)