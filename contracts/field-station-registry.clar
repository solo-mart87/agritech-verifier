;; Field Station Registry Smart Contract
;; Manages agricultural field research station verification and capabilities

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u200))
(define-constant err-not-found (err u201))
(define-constant err-already-exists (err u202))
(define-constant err-invalid-input (err u203))
(define-constant err-unauthorized (err u204))

;; Data Variables
(define-data-var next-station-id uint u1)

;; Data Maps
(define-map field-stations
  { station-id: uint }
  {
    name: (string-ascii 100),
    location: (string-ascii 100),
    research-type: (string-ascii 50),
    operator: principal,
    verified: bool,
    verification-date: uint,
    established-date: uint,
    status: (string-ascii 20)
  }
)

(define-map station-capabilities
  { station-id: uint, capability-id: uint }
  {
    capability-name: (string-ascii 50),
    description: (string-ascii 200),
    certified: bool,
    certification-date: uint
  }
)

(define-map station-capability-count
  { station-id: uint }
  { count: uint }
)

(define-map research-projects
  { station-id: uint, project-id: uint }
  {
    project-name: (string-ascii 100),
    start-date: uint,
    end-date: uint,
    status: (string-ascii 20),
    researcher: principal
  }
)

(define-map station-project-count
  { station-id: uint }
  { count: uint }
)

;; Public Functions

;; Register new field station
(define-public (register-station
  (name (string-ascii 100))
  (location (string-ascii 100))
  (research-type (string-ascii 50))
  (established-date uint))
  (let
    (
      (station-id (var-get next-station-id))
    )
    ;; Validate inputs
    (asserts! (> (len name) u0) err-invalid-input)
    (asserts! (> (len location) u0) err-invalid-input)
    (asserts! (> (len research-type) u0) err-invalid-input)
    (asserts! (> established-date u0) err-invalid-input)
    
    ;; Register station
    (map-set field-stations
      { station-id: station-id }
      {
        name: name,
        location: location,
        research-type: research-type,
        operator: tx-sender,
        verified: false,
        verification-date: u0,
        established-date: established-date,
        status: "registered"
      }
    )
    
    ;; Initialize capability and project counts
    (map-set station-capability-count
      { station-id: station-id }
      { count: u0 }
    )
    
    (map-set station-project-count
      { station-id: station-id }
      { count: u0 }
    )
    
    ;; Increment next station ID
    (var-set next-station-id (+ station-id u1))
    
    (ok station-id)
  )
)

;; Verify field station (only contract owner)
(define-public (verify-station (station-id uint))
  (let
    (
      (station (unwrap! (map-get? field-stations { station-id: station-id }) err-not-found))
    )
    ;; Only contract owner can verify
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    
    ;; Update station verification
    (map-set field-stations
      { station-id: station-id }
      (merge station {
        verified: true,
        verification-date: stacks-block-height,
        status: "verified"
      })
    )
    
    (ok true)
  )
)

;; Add station capability
(define-public (add-capability
  (station-id uint)
  (capability-name (string-ascii 50))
  (description (string-ascii 200)))
  (let
    (
      (station (unwrap! (map-get? field-stations { station-id: station-id }) err-not-found))
      (capability-count-data (default-to { count: u0 } (map-get? station-capability-count { station-id: station-id })))
      (capability-id (get count capability-count-data))
    )
    ;; Only station operator can add capabilities
    (asserts! (is-eq tx-sender (get operator station)) err-unauthorized)
    
    ;; Add capability
    (map-set station-capabilities
      { station-id: station-id, capability-id: capability-id }
      {
        capability-name: capability-name,
        description: description,
        certified: false,
        certification-date: u0
      }
    )
    
    ;; Update capability count
    (map-set station-capability-count
      { station-id: station-id }
      { count: (+ capability-id u1) }
    )
    
    (ok capability-id)
  )
)

;; Certify station capability (only contract owner)
(define-public (certify-capability (station-id uint) (capability-id uint))
  (let
    (
      (capability (unwrap! (map-get? station-capabilities { station-id: station-id, capability-id: capability-id }) err-not-found))
    )
    ;; Only contract owner can certify
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    
    ;; Update capability certification
    (map-set station-capabilities
      { station-id: station-id, capability-id: capability-id }
      (merge capability {
        certified: true,
        certification-date: stacks-block-height
      })
    )
    
    (ok true)
  )
)

;; Add research project
(define-public (add-research-project
  (station-id uint)
  (project-name (string-ascii 100))
  (start-date uint)
  (end-date uint))
  (let
    (
      (station (unwrap! (map-get? field-stations { station-id: station-id }) err-not-found))
      (project-count-data (default-to { count: u0 } (map-get? station-project-count { station-id: station-id })))
      (project-id (get count project-count-data))
    )
    ;; Only station operator can add projects
    (asserts! (is-eq tx-sender (get operator station)) err-unauthorized)
    (asserts! (< start-date end-date) err-invalid-input)
    
    ;; Add project
    (map-set research-projects
      { station-id: station-id, project-id: project-id }
      {
        project-name: project-name,
        start-date: start-date,
        end-date: end-date,
        status: "active",
        researcher: tx-sender
      }
    )
    
    ;; Update project count
    (map-set station-project-count
      { station-id: station-id }
      { count: (+ project-id u1) }
    )
    
    (ok project-id)
  )
)

;; Transfer station ownership
(define-public (transfer-station (station-id uint) (new-operator principal))
  (let
    (
      (station (unwrap! (map-get? field-stations { station-id: station-id }) err-not-found))
    )
    ;; Only current operator can transfer
    (asserts! (is-eq tx-sender (get operator station)) err-unauthorized)
    
    ;; Update operator
    (map-set field-stations
      { station-id: station-id }
      (merge station { operator: new-operator })
    )
    
    (ok true)
  )
)

;; Read-only Functions

;; Get station information
(define-read-only (get-station-info (station-id uint))
  (map-get? field-stations { station-id: station-id })
)

;; Get station capability
(define-read-only (get-capability (station-id uint) (capability-id uint))
  (map-get? station-capabilities { station-id: station-id, capability-id: capability-id })
)

;; Get capability count
(define-read-only (get-capability-count (station-id uint))
  (default-to { count: u0 } (map-get? station-capability-count { station-id: station-id }))
)

;; Get research project
(define-read-only (get-research-project (station-id uint) (project-id uint))
  (map-get? research-projects { station-id: station-id, project-id: project-id })
)

;; Get project count
(define-read-only (get-project-count (station-id uint))
  (default-to { count: u0 } (map-get? station-project-count { station-id: station-id }))
)

;; Check if station is verified
(define-read-only (is-station-verified (station-id uint))
  (match (map-get? field-stations { station-id: station-id })
    station (get verified station)
    false
  )
)

;; Get next station ID
(define-read-only (get-next-station-id)
  (var-get next-station-id)
)