type PusherServerConstructor = typeof import("pusher");

export type BrowserPusherChannel = import("pusher-js").Channel;

export type RealtimeChannelDescriptor =
  | { kind: "user"; id: string }
  | { kind: "conversation"; id: string }
  | { kind: "order"; id: string };

export interface RealtimeUserIdentity {
  id: string;
  name: string | null;
  image: string | null;
}

export interface RealtimeNotificationPayload {
  id: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface RealtimeTypingUser {
  senderId: string;
  role: "BUYER" | "SELLER";
  name: string | null;
}

export interface RealtimeTypingStatePayload {
  typingUsers: RealtimeTypingUser[];
}

export interface RealtimeConversationMessagePayload {
  id: string;
  text: string;
  imageUrl: string | null;
  isSystem: boolean;
  isRead: boolean;
  senderId: string;
  createdAt: string;
  updatedAt: string;
  sender: RealtimeUserIdentity;
}

export interface RealtimeOrderMessagePayload {
  id: string;
  content: string;
  imageUrl: string | null;
  isSystem: boolean;
  isRead: boolean;
  senderId: string;
  createdAt: string;
  updatedAt: string;
  sender: RealtimeUserIdentity;
}

export interface RealtimeOrderUpdatedPayload {
  orderId: string;
  status: string;
  platformFee: string | null;
  refundAmount?: string | null;
  sellerNetAmount?: string | null;
}

export const PUSHER_MESSAGE_EVENT = "new-message";
export const PUSHER_NOTIFICATION_EVENT = "new-notification";
export const PUSHER_TYPING_EVENT = "typing-state";
export const PUSHER_ORDER_UPDATED_EVENT = "order-updated";

const PUSHER_AUTH_ENDPOINT = "/api/pusher/auth";
const USER_CHANNEL_PREFIX = "private-user-";
const CONVERSATION_CHANNEL_PREFIX = "private-conversation-";
const ORDER_CHANNEL_PREFIX = "private-order-";

const PUSHER_APP_ID = process.env.PUSHER_APP_ID?.trim() ?? "";
const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY?.trim() ?? "";
const PUSHER_SECRET = process.env.PUSHER_SECRET?.trim() ?? "";
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim() ?? "";

const warnedScopes = new Set<string>();

let browserPusherPromise: Promise<import("pusher-js").default | null> | null = null;
let serverPusherPromise: Promise<InstanceType<PusherServerConstructor> | null> | null =
  null;

function hasClientPusherConfig() {
  return Boolean(PUSHER_KEY && PUSHER_CLUSTER);
}

function hasServerPusherConfig() {
  return Boolean(PUSHER_APP_ID && PUSHER_KEY && PUSHER_SECRET && PUSHER_CLUSTER);
}

function warnMissingPusherConfig(scope: "client" | "server") {
  if (warnedScopes.has(scope)) {
    return;
  }

  warnedScopes.add(scope);
  console.warn(
    `[PUSHER_CONFIG_MISSING] ${scope} realtime updates are disabled because Pusher environment variables are incomplete.`,
  );
}

function resolvePusherServerConstructor(
  module: { default?: PusherServerConstructor } & Record<string, unknown>,
) {
  return ((module as { default?: PusherServerConstructor }).default ??
    (module as unknown as PusherServerConstructor)) as PusherServerConstructor;
}

export function getChatChannelName(chatId: string) {
  return getConversationChannelName(chatId);
}

export function getUserChannelName(userId: string) {
  return getUserNotificationChannelName(userId);
}

export function getConversationChannelName(conversationId: string) {
  return `${CONVERSATION_CHANNEL_PREFIX}${conversationId}`;
}

export function getOrderChannelName(orderId: string) {
  return `${ORDER_CHANNEL_PREFIX}${orderId}`;
}

export function getUserNotificationChannelName(userId: string) {
  return `${USER_CHANNEL_PREFIX}${userId}`;
}

function parsePrefixedChannelName(
  channelName: string,
  prefix: string,
  kind: RealtimeChannelDescriptor["kind"],
): RealtimeChannelDescriptor | null {
  if (!channelName.startsWith(prefix)) {
    return null;
  }

  const id = channelName.slice(prefix.length).trim();

  if (!id) {
    return null;
  }

  return {
    kind,
    id,
  };
}

export function parseRealtimeChannelName(
  channelName: string,
): RealtimeChannelDescriptor | null {
  return (
    parsePrefixedChannelName(channelName, USER_CHANNEL_PREFIX, "user") ??
    parsePrefixedChannelName(
      channelName,
      CONVERSATION_CHANNEL_PREFIX,
      "conversation",
    ) ??
    parsePrefixedChannelName(channelName, ORDER_CHANNEL_PREFIX, "order")
  );
}

export async function getPusherServerClient() {
  if (typeof window !== "undefined") {
    return null;
  }

  if (!hasServerPusherConfig()) {
    warnMissingPusherConfig("server");
    return null;
  }

  if (!serverPusherPromise) {
    serverPusherPromise = import("pusher")
      .then((module) => {
        const Pusher = resolvePusherServerConstructor(module);

        return new Pusher({
          appId: PUSHER_APP_ID,
          key: PUSHER_KEY,
          secret: PUSHER_SECRET,
          cluster: PUSHER_CLUSTER,
          useTLS: true,
        });
      })
      .catch((error) => {
        console.error("[PUSHER_SERVER_INIT_ERROR]", error);
        return null;
      });
  }

  return serverPusherPromise;
}

export async function getPusherClient() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!hasClientPusherConfig()) {
    warnMissingPusherConfig("client");
    return null;
  }

  if (!browserPusherPromise) {
    browserPusherPromise = import("pusher-js")
      .then(({ default: Pusher }) => {
        const client = new Pusher(PUSHER_KEY, {
          cluster: PUSHER_CLUSTER,
          forceTLS: true,
          channelAuthorization: {
            endpoint: PUSHER_AUTH_ENDPOINT,
            transport: "ajax",
          },
        });

        client.connect();

        return client;
      })
      .catch((error) => {
        console.error("[PUSHER_CLIENT_INIT_ERROR]", error);
        return null;
      });
  }

  return browserPusherPromise;
}

async function triggerPusherEvent(channelName: string, eventName: string, payload: unknown) {
  const pusher = await getPusherServerClient();

  if (!pusher) {
    return;
  }

  try {
    await pusher.trigger(channelName, eventName, payload);
  } catch (error) {
    console.error("[PUSHER_TRIGGER_ERROR]", {
      channelName,
      eventName,
      error,
    });
  }
}

export async function publishConversationMessageEvent<T extends object>(
  conversationId: string,
  messageData: T,
) {
  await triggerPusherEvent(
    getConversationChannelName(conversationId),
    PUSHER_MESSAGE_EVENT,
    messageData,
  );
}

export async function publishOrderMessageEvent<T extends object>(
  orderId: string,
  messageData: T,
) {
  await triggerPusherEvent(
    getOrderChannelName(orderId),
    PUSHER_MESSAGE_EVENT,
    messageData,
  );
}

export async function publishUserNotificationEvent(
  userId: string,
  notificationData: RealtimeNotificationPayload,
) {
  await triggerPusherEvent(
    getUserNotificationChannelName(userId),
    PUSHER_NOTIFICATION_EVENT,
    notificationData,
  );
}

export async function publishConversationTypingStateEvent(
  conversationId: string,
  typingUsers: RealtimeTypingUser[],
) {
  await triggerPusherEvent(
    getConversationChannelName(conversationId),
    PUSHER_TYPING_EVENT,
    {
      typingUsers,
    } satisfies RealtimeTypingStatePayload,
  );
}

export async function publishOrderTypingStateEvent(
  orderId: string,
  typingUsers: RealtimeTypingUser[],
) {
  await triggerPusherEvent(
    getOrderChannelName(orderId),
    PUSHER_TYPING_EVENT,
    {
      typingUsers,
    } satisfies RealtimeTypingStatePayload,
  );
}

export async function publishOrderUpdatedEvent(
  payload: RealtimeOrderUpdatedPayload,
) {
  await triggerPusherEvent(
    getOrderChannelName(payload.orderId),
    PUSHER_ORDER_UPDATED_EVENT,
    payload,
  );
}