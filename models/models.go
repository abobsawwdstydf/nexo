package models

import "time"

type User struct {
	ID           string     `json:"id" gorm:"primaryKey"`
	Username     string     `json:"username" gorm:"uniqueIndex;size:64"`
	DisplayName  string     `json:"displayName" gorm:"size:128"`
	Email        string     `json:"email" gorm:"uniqueIndex;size:256"`
	Phone        string     `json:"phone" gorm:"size:32"`
	Password     string     `json:"-"`
	GlobalPassword string   `json:"-" gorm:"size:256"`
	Avatar       string     `json:"avatar"`
	Bio          string     `json:"bio"`
	Birthday     string     `json:"birthday"`
	IsOnline     bool       `json:"isOnline" gorm:"default:false"`
	IsVerified   bool       `json:"isVerified" gorm:"default:false"`
	IsPremium    bool       `json:"isPremium" gorm:"default:false"`
	IsBanned     bool       `json:"isBanned" gorm:"default:false"`
	BanReason    string     `json:"banReason"`
	IsAdmin      bool       `json:"isAdmin" gorm:"default:false"`
	PremiumUntil *time.Time `json:"premiumUntil"`
	Subscribers  int        `json:"subscribersCount" gorm:"default:0"`
	IsVerifiedByBot bool   `json:"isVerifiedByBot" gorm:"default:false"`
	LastSeen     time.Time  `json:"lastSeen" gorm:"autoCreateTime"`
	CreatedAt    time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt    time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`

	// Signal Protocol
	IdentityKey  string `json:"identityKey"`
	SignedPreKey string `json:"signedPreKey"`
	OneTimePreKeys string `json:"oneTimePreKeys"`

	// Settings
	NotifyAll        bool   `json:"notifyAll" gorm:"default:true"`
	NotifyMessages   bool   `json:"notifyMessages" gorm:"default:true"`
	NotifyCalls      bool   `json:"notifyCalls" gorm:"default:true"`
	NotifyFriends    bool   `json:"notifyFriends" gorm:"default:true"`
	TwoFactorEnabled bool   `json:"twoFactorEnabled" gorm:"default:false"`

	// Privacy
	WhoCanMessage    string `json:"whoCanMessage" gorm:"size:32;default:everyone"`
	WhoCanCall       string `json:"whoCanCall" gorm:"size:32;default:everyone"`
	WhoCanSeeProfile string `json:"whoCanSeeProfile" gorm:"size:32;default:everyone"`
	ShowLastSeen     bool   `json:"showLastSeen" gorm:"default:true"`
	AllowGroupInvites bool  `json:"allowGroupInvites" gorm:"default:true"`

	// Appearance
	NameColor    string `json:"nameColor"`
	NameGradient string `json:"nameGradient"`

	// Relationships
	FriendshipsSent     []Friendship `gorm:"foreignKey:UserID"`
	FriendshipsReceived []Friendship `gorm:"foreignKey:FriendID"`
	ChatMembers         []ChatMember `gorm:"foreignKey:UserID"`
}

type Chat struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	Type            string    `json:"type" gorm:"size:32;default:personal"`
	Name            string    `json:"name" gorm:"size:128"`
	Username        string    `json:"username" gorm:"uniqueIndex;size:64"`
	Avatar          string    `json:"avatar"`
	Description     string    `json:"description"`
	IsVerified      bool      `json:"isVerified" gorm:"default:false"`
	IsSecret        bool      `json:"isSecret" gorm:"default:false"`
	IsE2E           bool      `json:"isE2E" gorm:"default:false"`
	SubscribersCount int     `json:"subscribersCount" gorm:"default:0"`
	CanMembersPost   bool      `json:"canMembersPost" gorm:"default:true"`
	CanMembersInvite bool      `json:"canMembersInvite" gorm:"default:true"`
	SlowModeInterval int       `json:"slowModeInterval" gorm:"default:0"`
	WelcomeMessage   string    `json:"welcomeMessage"`
	Rules            string    `json:"rules"`
	CustomIcon       string    `json:"customIcon"`
	CustomColor      string    `json:"customColor"`
	CustomBackground string    `json:"customBackground"`
	CreatedAt       time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt       time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Members  []ChatMember `gorm:"foreignKey:ChatID"`
	Messages []Message    `gorm:"foreignKey:ChatID"`
}

type ChatMember struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	ChatID      string    `json:"chatId" gorm:"index"`
	UserID      string    `json:"userId" gorm:"index"`
	Role        string    `json:"role" gorm:"size:32;default:member"`
	JoinedAt    time.Time `json:"joinedAt" gorm:"autoCreateTime"`
	IsMuted     bool      `json:"isMuted" gorm:"default:false"`
	IsArchived  bool      `json:"isArchived" gorm:"default:false"`
	IsPinned    bool      `json:"isPinned" gorm:"default:false"`
	ClearedAt   *time.Time `json:"clearedAt"`
	LastMessageAt *time.Time `json:"lastMessageAt"`

	Chat Chat `json:"chat" gorm:"foreignKey:ChatID"`
	User User `json:"user" gorm:"foreignKey:UserID"`
}

func (ChatMember) TableName() string { return "chat_members" }

type Message struct {
	ID               string     `json:"id" gorm:"primaryKey"`
	ChatID           string     `json:"chatId" gorm:"index:idx_chat_created"`
	SenderID         string     `json:"senderId" gorm:"index"`
	Content          string     `json:"content"`
	Type             string     `json:"type" gorm:"size:32;default:text"`
	ReplyToID        string     `json:"replyToId"`
	ForwardedFromID  string     `json:"forwardedFromId"`
	IsEdited         bool       `json:"isEdited" gorm:"default:false"`
	IsDeleted        bool       `json:"isDeleted" gorm:"default:false"`
	ScheduledAt      *time.Time `json:"scheduledAt"`
	CreatedAt        time.Time  `json:"createdAt" gorm:"autoCreateTime;index:idx_chat_created"`
	UpdatedAt        time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
	EditedAt         *time.Time `json:"editedAt"`
	VideoURL         string     `json:"videoUrl"`
	Duration         int        `json:"duration"`
	Thumbnail        string     `json:"thumbnail"`
	IsEncrypted      bool       `json:"isEncrypted" gorm:"default:false"`
	EncryptedContent string     `json:"encryptedContent"`
	SenderKeyID      string     `json:"senderKeyId"`
	ThreadID         string     `json:"threadId"`
	SelfDestructTimer int      `json:"selfDestructTimer"`
	CanForward       bool       `json:"canForward" gorm:"default:true"`
	CanScreenshot    bool       `json:"canScreenshot" gorm:"default:true"`

	Sender        User          `json:"sender" gorm:"foreignKey:SenderID"`
	Chat          Chat          `json:"-" gorm:"foreignKey:ChatID"`
	ReplyTo       *Message      `json:"replyTo,omitempty" gorm:"foreignKey:ReplyToID"`
	ForwardedFrom *User         `json:"forwardedFrom,omitempty" gorm:"foreignKey:ForwardedFromID"`
	Media         []Media       `json:"media" gorm:"foreignKey:MessageID"`
	Reactions     []Reaction    `json:"reactions" gorm:"foreignKey:MessageID"`
	ReadBy        []ReadReceipt `json:"readBy" gorm:"foreignKey:MessageID"`
}

type Media struct {
	ID        string  `json:"id" gorm:"primaryKey"`
	MessageID string  `json:"messageId" gorm:"index"`
	Type      string  `json:"type" gorm:"size:32"`
	URL       string  `json:"url"`
	Filename  string  `json:"filename"`
	Thumbnail string  `json:"thumbnail"`
	Size      int     `json:"size"`
	Duration  float64 `json:"duration"`
	Width     int     `json:"width"`
	Height    int     `json:"height"`
	Order     int     `json:"order" gorm:"default:0"`

	ConvertedURL    string `json:"convertedUrl"`
	OriginalFormat  string `json:"originalFormat"`

	Message Message `json:"-" gorm:"foreignKey:MessageID"`
}

type Reaction struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	MessageID string    `json:"messageId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	Emoji     string    `json:"emoji" gorm:"size:16"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Message Message `json:"-" gorm:"foreignKey:MessageID"`
	User    User    `json:"user" gorm:"foreignKey:UserID"`
}

type ReadReceipt struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	MessageID string    `json:"messageId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	ReadAt    time.Time `json:"readAt" gorm:"autoCreateTime"`

	Message Message `json:"-" gorm:"foreignKey:MessageID"`
	User    User    `json:"-" gorm:"foreignKey:UserID"`
}

type Story struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	UserID        string    `json:"userId" gorm:"index"`
	Type          string    `json:"type" gorm:"size:32;default:text"`
	MediaURL      string    `json:"mediaUrl"`
	Content       string    `json:"content"`
	BgColor       string    `json:"bgColor"`
	IsHighlight   bool      `json:"isHighlight" gorm:"default:false"`
	HighlightTitle string   `json:"highlightTitle"`
	HighlightCover string  `json:"highlightCover"`
	CreatedAt     time.Time `json:"createdAt" gorm:"autoCreateTime"`
	ExpiresAt     time.Time `json:"expiresAt" gorm:"index"`

	User        User         `json:"user" gorm:"foreignKey:UserID"`
	Views       []StoryView  `json:"views" gorm:"foreignKey:StoryID"`
	Reactions   []StoryReaction `json:"reactions" gorm:"foreignKey:StoryID"`
}

type StoryView struct {
	ID       string    `json:"id" gorm:"primaryKey"`
	StoryID  string    `json:"storyId" gorm:"index"`
	UserID   string    `json:"userId" gorm:"index"`
	ViewedAt time.Time `json:"viewedAt" gorm:"autoCreateTime"`

	Story Story `json:"-" gorm:"foreignKey:StoryID"`
	User  User  `json:"user" gorm:"foreignKey:UserID"`
}

type StoryReaction struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	StoryID   string    `json:"storyId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	Emoji     string    `json:"emoji" gorm:"size:16"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Story Story `json:"-" gorm:"foreignKey:StoryID"`
}

type Friendship struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	FriendID  string    `json:"friendId" gorm:"index"`
	Status    string    `json:"status" gorm:"size:32;default:pending"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User   User `json:"user" gorm:"foreignKey:UserID"`
	Friend User `json:"friend" gorm:"foreignKey:FriendID"`
}

type CallLog struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	CallerID  string    `json:"callerId" gorm:"index"`
	CalleeID  string    `json:"calleeId" gorm:"index"`
	ChatID    string    `json:"chatId"`
	Type      string    `json:"type" gorm:"size:32;default:voice"`
	Status    string    `json:"status" gorm:"size:32;default:completed"`
	Duration  float64   `json:"duration"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Caller User  `json:"caller" gorm:"foreignKey:CallerID"`
	Callee *User `json:"callee,omitempty" gorm:"foreignKey:CalleeID"`
}

type TypingIndicator struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	ChatID    string    `json:"chatId" gorm:"index"`
	UserID    string    `json:"userId"`
	StartedAt time.Time `json:"startedAt" gorm:"autoCreateTime"`
	ExpiresAt time.Time `json:"expiresAt" gorm:"index"`

	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
	User User `json:"-" gorm:"foreignKey:UserID"`
}

type StickerPack struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatorID   string    `json:"creatorId"`
	Thumbnail   string    `json:"thumbnail"`
	IsPublic    bool      `json:"isPublic" gorm:"default:true"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Stickers []Sticker `json:"stickers" gorm:"foreignKey:PackID"`
}

type Sticker struct {
	ID       string `json:"id" gorm:"primaryKey"`
	PackID   string `json:"packId" gorm:"index"`
	Emoji    string `json:"emoji" gorm:"size:16"`
	FileURL  string `json:"fileUrl"`
	FileSize int    `json:"fileSize"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Order    int    `json:"order" gorm:"default:0"`

	Pack StickerPack `json:"-" gorm:"foreignKey:PackID"`
}

type Bookmark struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	MessageID string    `json:"messageId"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User    User    `json:"-" gorm:"foreignKey:UserID"`
	Message Message `json:"message" gorm:"foreignKey:MessageID"`
}

type BlockedUser struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	UserID        string    `json:"userId" gorm:"index"`
	BlockedUserID string    `json:"blockedUserId" gorm:"index"`
	CreatedAt     time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User        User `json:"-" gorm:"foreignKey:UserID"`
	BlockedUser User `json:"blockedUser" gorm:"foreignKey:BlockedUserID"`
}

type UserDevice struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	UserID       string    `json:"userId" gorm:"index"`
	DeviceID     string    `json:"deviceId" gorm:"uniqueIndex;size:128"`
	DeviceName   string    `json:"deviceName" gorm:"size:128"`
	DeviceType   string    `json:"deviceType" gorm:"size:32"`
	Platform     string    `json:"platform" gorm:"size:32"`
	IPAddress    string    `json:"ipAddress" gorm:"size:45"`
	IdentityKey  string    `json:"identityKey"`
	SignedPreKey string    `json:"signedPreKey"`
	LastActive   time.Time `json:"lastActive" gorm:"autoCreateTime"`
	CreatedAt    time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

type VerificationRequest struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	Provider  string    `json:"provider" gorm:"size:32"` // "telegram" or "max"
	Token     string    `json:"token" gorm:"size:128"`  // verification token
	Code      string    `json:"code" gorm:"size:16"`     // numeric code user enters
	Status    string    `json:"status" gorm:"size:32;default:pending"` // pending, confirmed, expired
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	ExpiresAt time.Time `json:"expiresAt"`

	User User `json:"user" gorm:"foreignKey:UserID"`
}

type Payment struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	UserID        string    `json:"userId" gorm:"index"`
	YooKassaID    string    `json:"yooKassaId" gorm:"uniqueIndex;size:128"`
	Amount        int       `json:"amount"` // in rubles
	Currency      string    `json:"currency" gorm:"size:3;default:RUB"`
	Type          string    `json:"type" gorm:"size:32"` // "premium", "premium_gift"
	Status        string    `json:"status" gorm:"size:32;default:pending"` // pending, succeeded, canceled
	GiftToUserID  string    `json:"giftToUserId"` // for gifts
	PremiumMonths int       `json:"premiumMonths"`
	Metadata      string    `json:"metadata"` // JSON metadata
	CreatedAt     time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt     time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User        User  `json:"user" gorm:"foreignKey:UserID"`
	GiftToUser  *User `json:"giftToUser,omitempty" gorm:"foreignKey:GiftToUserID"`
}

type BotHealthCheck struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Provider  string    `json:"provider" gorm:"size:32;uniqueIndex"` // "telegram" or "max"
	IsHealthy bool      `json:"isHealthy" gorm:"default:false"`
	LastCheck time.Time `json:"lastCheck"`
	Error     string    `json:"error"`
}

type WallPost struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	AuthorID       string    `json:"authorId" gorm:"index"`
	Content        string    `json:"content"`
	ViewsCount     int       `json:"viewsCount" gorm:"default:0"`
	OriginalPostID string    `json:"originalPostId"`
	CreatedAt      time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt      time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Author   User              `json:"author" gorm:"foreignKey:AuthorID"`
	Media    []WallPostMedia   `json:"media" gorm:"foreignKey:PostID"`
	Reactions []WallPostReaction `json:"reactions" gorm:"foreignKey:PostID"`
	Comments []WallPostComment `json:"comments" gorm:"foreignKey:PostID"`
}

type WallPostMedia struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	PostID    string    `json:"postId" gorm:"index"`
	Type      string    `json:"type" gorm:"size:32"`
	URL       string    `json:"url"`
	Thumbnail string    `json:"thumbnail"`
	Duration  float64   `json:"duration"`
	Size      int       `json:"size"`
	Order     int       `json:"order" gorm:"default:0"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Post WallPost `json:"-" gorm:"foreignKey:PostID"`
}

type WallPostReaction struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	PostID    string    `json:"postId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	Emoji     string    `json:"emoji" gorm:"size:16"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Post WallPost `json:"-" gorm:"foreignKey:PostID"`
}

type WallPostComment struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	PostID      string    `json:"postId" gorm:"index"`
	AuthorID    string    `json:"authorId" gorm:"index"`
	ParentID    string    `json:"parentId"`
	Content     string    `json:"content"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Post     WallPost          `json:"-" gorm:"foreignKey:PostID"`
	Author   User              `json:"author" gorm:"foreignKey:AuthorID"`
	Replies   []WallPostComment `json:"replies,omitempty" gorm:"foreignKey:ParentID"`
}

// API request/response types
type RegisterRequest struct {
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	Password    string `json:"password"`
	Bio         string `json:"bio"`
	Birthday    string `json:"birthday"`
}

type VerifyRequest struct {
	Provider string `json:"provider"` // "telegram" or "max"
}

type VerifyConfirmRequest struct {
	Provider string `json:"provider"`
	Code     string `json:"code"`
}

type CreatePaymentRequest struct {
	Type          string `json:"type"` // "premium" or "premium_gift"
	PremiumMonths int    `json:"premiumMonths"`
	GiftToUserID  string `json:"giftToUserId,omitempty"`
}

type PaymentCallbackRequest struct {
	Status string `json:"status"`
}

type BotHealthStatus struct {
	Telegram *BotProviderStatus `json:"telegram"`
	Max      *BotProviderStatus `json:"max"`
}

type BotProviderStatus struct {
	Available bool   `json:"available"`
	Healthy   bool   `json:"healthy"`
	Error     string `json:"error,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginSendCodeRequest struct {
	Email string `json:"email"`
}

type LoginConfirmRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type SetGlobalPasswordRequest struct {
	Password string `json:"password"`
}

type AuthResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	User         User   `json:"user"`
}

type LoginCodeResponse struct {
	RequiresCode bool   `json:"requiresCode"`
	ExpiresAt    string `json:"expiresAt,omitempty"`
}

type SendMessageRequest struct {
	Content         string `json:"content"`
	Type            string `json:"type"`
	ReplyToID       string `json:"replyToId"`
	ForwardedFromID string `json:"forwardedFromId"`
	IsEncrypted     bool   `json:"isEncrypted"`
	EncryptedContent string `json:"encryptedContent"`
}

type CreateChatRequest struct {
	Type            string `json:"type"`
	Name            string `json:"name"`
	Username        string `json:"username"`
	MemberIDs       []string `json:"memberIds"`
	IsSecret        bool   `json:"isSecret"`
	IsE2E           bool   `json:"isE2E"`
	WelcomeMessage  string `json:"welcomeMessage"`
}

type UpdateProfileRequest struct {
	DisplayName string `json:"displayName"`
	Bio         string `json:"bio"`
	Birthday    string `json:"birthday"`
	Avatar      string `json:"avatar"`
	NameColor   string `json:"nameColor"`
	NameGradient string `json:"nameGradient"`
}

type PaginatedResponse[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	HasMore  bool  `json:"hasMore"`
}

type EmailVerification struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Email     string    `json:"email" gorm:"index;size:256"`
	Code      string    `json:"-" gorm:"size:8"`
	Status    string    `json:"status" gorm:"size:32;default:pending"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type SendEmailCodeRequest struct {
	Email string `json:"email"`
}

type ConfirmEmailCodeRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

// ─── Bot API Models ────────────────────────────────────────────────────────

type Bot struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"size:128"`
	Username    string    `json:"username" gorm:"uniqueIndex;size:64"`
	Token       string    `json:"-" gorm:"uniqueIndex;size:256"`
	OwnerID     string    `json:"ownerId" gorm:"index"`
	Description string    `json:"description"`
	Avatar      string    `json:"avatar"`
	WebhookURL  string    `json:"webhookUrl"`
	IsActive    bool      `json:"isActive" gorm:"default:true"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Commands      []BotCommand      `json:"commands" gorm:"foreignKey:BotID"`
	Installations []BotInstallation `json:"installations" gorm:"foreignKey:BotID"`
}

type BotCommand struct {
	ID          string `json:"id" gorm:"primaryKey"`
	BotID       string `json:"botId" gorm:"index"`
	Command     string `json:"command" gorm:"size:64"`
	Description string `json:"description"`
	Response    string `json:"response"`
	HandlerURL  string `json:"handlerUrl"`
	IsActive    bool   `json:"isActive" gorm:"default:true"`

	Bot Bot `json:"-" gorm:"foreignKey:BotID"`
}

type BotInstallation struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	BotID       string    `json:"botId" gorm:"index"`
	ChatID      string    `json:"chatId" gorm:"index"`
	InstalledBy string    `json:"installedBy"`
	IsActive    bool      `json:"isActive" gorm:"default:true"`
	InstalledAt time.Time `json:"installedAt" gorm:"autoCreateTime"`

	Bot Bot `json:"-" gorm:"foreignKey:BotID"`
}

// ─── Search History ────────────────────────────────────────────────────────

type SearchHistory struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"userId" gorm:"index"`
	Query       string    `json:"query"`
	Type        string    `json:"type" gorm:"size:32"`
	ResultCount int       `json:"resultCount"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

// ─── Moderation ────────────────────────────────────────────────────────────

type ModerationLog struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	ChatID    string    `json:"chatId" gorm:"index"`
	TargetID  string    `json:"targetId" gorm:"index"`
	ActorID   string    `json:"actorId" gorm:"index"`
	Action    string    `json:"action" gorm:"size:32"`
	Reason    string    `json:"reason"`
	Duration  int       `json:"duration"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

// ─── API Request Types for Bots ────────────────────────────────────────────

type CreateBotRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Avatar      string `json:"avatar"`
	WebhookURL  string `json:"webhookUrl"`
}

type UpdateBotRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Avatar      string `json:"avatar"`
	WebhookURL  string `json:"webhookUrl"`
	IsActive    *bool  `json:"isActive"`
}

type AddBotCommandRequest struct {
	Command     string `json:"command"`
	Description string `json:"description"`
	Response    string `json:"response"`
	HandlerURL  string `json:"handlerUrl"`
}

type BotSendMessageRequest struct {
	ChatID  string `json:"chatId"`
	Content string `json:"content"`
	Type    string `json:"type"`
}

type SetWebhookRequest struct {
	URL string `json:"url"`
}

type PrivacySettingsRequest struct {
	WhoCanMessage    string `json:"whoCanMessage"`
	WhoCanCall       string `json:"whoCanCall"`
	WhoCanSeeProfile string `json:"whoCanSeeProfile"`
	ShowLastSeen     *bool  `json:"showLastSeen"`
	AllowGroupInvites *bool `json:"allowGroupInvites"`
}

type BanUserRequest struct {
	TargetID string `json:"targetId"`
	Reason   string `json:"reason"`
	Duration int    `json:"duration"` // minutes, 0 = permanent
}

type MuteUserRequest struct {
	TargetID string `json:"targetId"`
	Duration int    `json:"duration"` // minutes, 0 = default 1 hour
}

type KickUserRequest struct {
	TargetID string `json:"targetId"`
}

type SlowModeRequest struct {
	Interval int `json:"interval"` // seconds, 0 = off
}
