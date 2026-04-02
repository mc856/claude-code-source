// Minimal OAuth type shim for reconstructed source trees.

export type SubscriptionType = string | null
export type RateLimitTier = string | null
export type BillingType = string | null

export type OAuthProfileResponse = any
export type OAuthTokenExchangeResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  account?: {
    uuid: string
    email_address: string
  }
  organization?: {
    uuid: string
  }
}

export type OAuthTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  scopes?: string[]
  subscriptionType?: SubscriptionType
  rateLimitTier?: RateLimitTier
  profile?: OAuthProfileResponse
  tokenAccount?: {
    uuid: string
    emailAddress: string
    organizationUuid?: string
  }
}

export type UserRolesResponse = any
export type ReferralEligibilityResponse = any
export type ReferralRedemptionsResponse = any
export type ReferrerRewardInfo = any
