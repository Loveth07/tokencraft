;; TokenCraft Token Factory Contract
;;
;; A secure and flexible contract for creating and managing custom tokens
;; on the Stacks blockchain. Provides strict access control and token registry
;; functionality with comprehensive event logging.
;;
;; Key Features:
;; - Administrator management
;; - Token creation with validation
;; - Basic token registry
;; - Event logging for token creation

;; Error Codes
(define-constant ERR_UNAUTHORIZED (err u1))
(define-constant ERR_INVALID_PARAMS (err u2))
(define-constant ERR_TOKEN_EXISTS (err u3))

;; Data Structures
;; Map to track administrator principals
(define-map administrators principal bool)

;; Map to store token metadata
(define-map tokens 
    {symbol: (string-ascii 32)} 
    {
        name: (string-ascii 64), 
        max-supply: uint, 
        decimals: uint
    }
)

;; Contract Owner Variable
(define-data-var contract-owner principal tx-sender)

;; Read-Only Functions
;; Check if a principal is an administrator
(define-read-only (is-admin (user principal))
    (default-to false (map-get? administrators user))
)

;; Public Functions
;; Set or remove administrator status
(define-public (set-administrator (user principal) (status bool))
    (begin
        ;; Only contract owner can modify administrator status
        (asserts! (is-eq tx-sender (var-get contract-owner)) ERR_UNAUTHORIZED)
        (map-set administrators user status)
        (ok true)
    )
)

;; Create a new token in the registry
(define-public (create-token 
                (symbol (string-ascii 32)) 
                (name (string-ascii 64)) 
                (max-supply uint) 
                (decimals uint))
    (begin
        ;; Verify caller is an administrator
        (asserts! (is-admin tx-sender) ERR_UNAUTHORIZED)
        
        ;; Validate max supply (must be greater than zero)
        (asserts! (> max-supply u0) ERR_INVALID_PARAMS)
        
        ;; Attempt to insert token, fail if token already exists
        (asserts! 
            (map-insert tokens {symbol: symbol} 
                              {
                                name: name, 
                                max-supply: max-supply, 
                                decimals: decimals
                              }
            ) 
            ERR_TOKEN_EXISTS
        )
        
        ;; Log token creation event
        (print {
            event: "token-created", 
            symbol: symbol, 
            name: name, 
            max-supply: max-supply
        })
        
        (ok true)
    )
)

;; Additional Read-Only Functions
;; Retrieve token details by symbol
(define-read-only (get-token-details (symbol (string-ascii 32)))
    (map-get? tokens {symbol: symbol})
)

;; Retrieve the contract owner
(define-read-only (get-contract-owner)
    (var-get contract-owner))