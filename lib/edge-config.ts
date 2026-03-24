import { get, getAll } from "@vercel/edge-config";
import { logError, logBusinessEvent } from "@/lib/logger";

export interface FeatureFlags {
  readonly maintenanceMode: boolean;
  readonly saleMode: boolean;
  readonly saleBannerText: string;
  readonly enableWishlist: boolean;
  readonly enableReviews: boolean;
}

export interface ShippingConfig {
  readonly freeShippingThreshold: number;
  readonly standardShippingRate: number;
  readonly expressShippingRate: number;
  readonly estimatedDeliveryDays: number;
}

export interface EdgeConfigData {
  readonly featureFlags: FeatureFlags;
  readonly shippingConfig: ShippingConfig;
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  maintenanceMode: false,
  saleMode: false,
  saleBannerText: "",
  enableWishlist: true,
  enableReviews: true,
};

const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  freeShippingThreshold: 999,
  standardShippingRate: 49,
  expressShippingRate: 149,
  estimatedDeliveryDays: 5,
};

const isEdgeConfigAvailable = (): boolean => !!process.env.EDGE_CONFIG;

export const getFeatureFlags = async (): Promise<FeatureFlags> => {
  if (!isEdgeConfigAvailable()) return DEFAULT_FEATURE_FLAGS;

  try {
    const flags = await get<FeatureFlags>("featureFlags");
    return flags ?? DEFAULT_FEATURE_FLAGS;
  } catch (error) {
    logError({ error, context: "edge_config_feature_flags" });
    return DEFAULT_FEATURE_FLAGS;
  }
};

export const getShippingConfig = async (): Promise<ShippingConfig> => {
  if (!isEdgeConfigAvailable()) return DEFAULT_SHIPPING_CONFIG;

  try {
    const config = await get<ShippingConfig>("shippingConfig");
    return config ?? DEFAULT_SHIPPING_CONFIG;
  } catch (error) {
    logError({ error, context: "edge_config_shipping" });
    return DEFAULT_SHIPPING_CONFIG;
  }
};

export const getAllEdgeConfig = async (): Promise<EdgeConfigData> => {
  if (!isEdgeConfigAvailable()) {
    return {
      featureFlags: DEFAULT_FEATURE_FLAGS,
      shippingConfig: DEFAULT_SHIPPING_CONFIG,
    };
  }

  try {
    const data = await getAll<{
      featureFlags: FeatureFlags;
      shippingConfig: ShippingConfig;
    }>(["featureFlags", "shippingConfig"]);

    logBusinessEvent({
      event: "edge_config_read",
      details: { keys: Object.keys(data) },
      success: true,
    });

    return {
      featureFlags: data.featureFlags ?? DEFAULT_FEATURE_FLAGS,
      shippingConfig: data.shippingConfig ?? DEFAULT_SHIPPING_CONFIG,
    };
  } catch (error) {
    logError({ error, context: "edge_config_get_all" });
    return {
      featureFlags: DEFAULT_FEATURE_FLAGS,
      shippingConfig: DEFAULT_SHIPPING_CONFIG,
    };
  }
};

export const isMaintenanceMode = async (): Promise<boolean> => {
  const flags = await getFeatureFlags();
  return flags.maintenanceMode;
};

export const isSaleActive = async (): Promise<boolean> => {
  const flags = await getFeatureFlags();
  return flags.saleMode;
};

export { DEFAULT_FEATURE_FLAGS, DEFAULT_SHIPPING_CONFIG };
