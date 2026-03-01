/**
 * ApiService - Crescio AI v3.0
 * Complete API service: auth, TikTok analytics, coaching, usage tracking, subscriptions
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// CONFIGURATION
// ============================================
const PRODUCTION_API_URL = 'https://crescio-ai.onrender.com';

const API_BASE_URL = __DEV__
  ? 'http://127.0.0.1:5000'
  : PRODUCTION_API_URL;

if (__DEV__) console.log(`API: DEV — ${API_BASE_URL}`);

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 180000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token + device ID to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // Always send device_id for tier tracking
  const deviceId = await AsyncStorage.getItem('device_id');
  if (deviceId) {
    config.headers['X-Device-ID'] = deviceId;
  }

  if (__DEV__) {
    console.log(`>> ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

// Response error handling
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`<< ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    if (__DEV__) {
      console.error(`<< ERR ${error.response?.status} ${error.message}`);
    }
    if (!error.response) {
      error.userMessage = 'Unable to connect. Check your internet connection.';
    } else if (error.response.status === 429) {
      error.userMessage = error.response.data?.error || 'Usage limit reached.';
      error.upgradeRequired = error.response.data?.upgrade_required || false;
      error.tierInfo = error.response.data;
    } else if (error.response.status === 413) {
      error.userMessage = error.response.data?.error || 'Video too long for your plan.';
      error.upgradeRequired = error.response.data?.upgrade_required || false;
      error.tierInfo = error.response.data;
    } else if (error.response.status === 403) {
      error.userMessage = error.response.data?.error || 'Access denied.';
      error.rateLimited = true;
    } else if (error.response.status === 401) {
      error.userMessage = 'Session expired. Please login again.';
      // Auto-clear stale auth tokens so next app launch goes to Login
      AsyncStorage.multiRemove(['auth_token', 'user_id', 'user_contact', 'user_tier']).catch(() => {});
      error.sessionExpired = true;
    } else if (error.response.status >= 500) {
      error.userMessage = 'Server error. Please try again later.';
    } else if (error.response.status === 400) {
      error.userMessage = error.response.data?.error || 'Invalid request.';
    } else if (error.response.status === 404) {
      error.userMessage = 'Resource not found.';
    }
    return Promise.reject(error);
  }
);

// ============================================
// API SERVICE
// ============================================
export const ApiService = {

  // ──────────────────────────────────────────
  // AUTH
  // ──────────────────────────────────────────

  /** Send OTP to email or phone */
  async sendOtp(contact: string, mode: 'email' | 'phone') {
    const response = await api.post('/auth/send-otp', { contact, mode });
    return response.data;
  },

  /** Invalidate session on backend */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort — even if this fails, we clear local tokens
    }
  },

  /** Verify OTP and get auth token + tier */
  async verifyOtp(contact: string, otp: string, mode: 'email' | 'phone' = 'email') {
    const deviceId = await AsyncStorage.getItem('device_id');
    const response = await api.post('/auth/verify-otp', {
      contact,
      otp,
      mode,
      device_id: deviceId || '',
    });
    return response.data; // { token, user_id, tier }
  },

  // ──────────────────────────────────────────
  // USAGE & SUBSCRIPTION
  // ──────────────────────────────────────────

  /** Get current tier, usage counts, and limits */
  async getUsageStatus() {
    const response = await api.get('/usage/status');
    return response.data;
  },

  /** Verify a Google Play subscription purchase */
  async verifySubscription(purchaseToken: string, productId: string, orderId: string) {
    const response = await api.post('/subscription/verify', {
      purchase_token: purchaseToken,
      product_id: productId,
      order_id: orderId,
    });
    return response.data;
  },

  // ──────────────────────────────────────────
  // TIKTOK
  // ──────────────────────────────────────────

  /** Get TikTok OAuth authorization URL */
  async getTikTokAuthUrl() {
    const response = await api.get('/tiktok/auth-url');
    return response.data; // { auth_url, state }
  },

  /** Exchange authorization code for access token */
  async exchangeTikTokCode(code: string, state: string) {
    const response = await api.post('/tiktok/connect', { code, state });
    return response.data; // { access_token, refresh_token, open_id }
  },

  /** Get TikTok user profile */
  async getTikTokProfile(accessToken: string) {
    const response = await api.get('/tiktok/profile', {
      headers: { 'X-TikTok-Token': accessToken },
    });
    return response.data;
  },

  /** Get aggregated engagement stats */
  async getTikTokStats(accessToken: string) {
    const response = await api.get('/tiktok/stats', {
      headers: { 'X-TikTok-Token': accessToken },
    });
    return response.data;
  },

  /** Get recent videos with metrics */
  async getTikTokVideos(accessToken: string) {
    const response = await api.get('/tiktok/videos', {
      headers: { 'X-TikTok-Token': accessToken },
    });
    return response.data; // array of video objects
  },

  // ──────────────────────────────────────────
  // VEO 3 VIDEO GENERATION (disabled)
  // ──────────────────────────────────────────

  /** Start video generation with Google Veo 3 */
  async generateVideo(params: {
    prompt: string;
    aspect_ratio: string;
    duration_seconds: number;
  }) {
    const response = await api.post('/veo/generate', params, {
      timeout: 60000,
    });
    return response.data; // { task_id, state }
  },

  /** Poll the status of a video generation task */
  async getVideoStatus(taskId: string) {
    const response = await api.get(`/veo/status/${taskId}`);
    return response.data; // { state, video_url?, thumbnail_url?, error_message? }
  },

  // ──────────────────────────────────────────
  // QUICK TOOLS (full-video processing)
  // ──────────────────────────────────────────

  /** Apply a quick tool to the full video. Returns { video_url, video_filename, ...metadata } */
  async applyQuickTool(tool: string, formData: FormData) {
    // Map frontend tool keys to backend route names
    const routeMap: Record<string, string> = {
      colorgrade: 'colorgrade',
      silence: 'silence-removal',
      speedramp: 'speed-ramp',
      captions: 'captions',
      autozoom: 'autozoom',
      voiceenhance: 'voice-enhance',
      reframe: 'reframe',
      highlights: 'highlights',
      smartcut: 'smartcut',
      aiedit: 'prompt-edit',
    };

    // AI Edit is async (Render 30s proxy limit) — submit then poll
    if (tool === 'aiedit') {
      const submitRes = await api.post('/tools/prompt-edit', formData, {
        headers: {'Content-Type': 'multipart/form-data'},
        timeout: 25000,
      });
      const taskId = submitRes.data?.task_id;
      if (!taskId) throw new Error('No task_id returned');

      const maxWait = 60 * 60 * 1000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        await new Promise(r => setTimeout(r, 3000));
        const poll = await api.get(`/tools/prompt-edit/status/${taskId}`, {timeout: 15000});
        if (poll.data.state === 'SUCCEEDED') return poll.data;
        if (poll.data.state === 'FAILED') {
          const msg = poll.data.error_message || 'AI edit failed';
          throw {message: msg, userMessage: msg};
        }
      }
      throw {message: 'AI edit timed out', userMessage: 'Edit took too long. Try a shorter video.'};
    }

    const route = routeMap[tool] || tool;
    const response = await api.post(`/tools/${route}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    });
    return response.data;
  },

  // ──────────────────────────────────────────
  // COACHING (existing)
  // ──────────────────────────────────────────

  async healthCheck() {
    const response = await api.get('/health');
    return response.data;
  },

  async selectNiche(niche: string) {
    const response = await api.post('/scrape/start', { niche, videoCount: 0 });
    return response.data;
  },

  async uploadAndAnalyzeVideo(videoUri: string, fileName: string, niche: string) {
    const formData = new FormData();
    formData.append('video', { uri: videoUri, type: 'video/mp4', name: fileName } as any);
    formData.append('niche', niche);
    const response = await api.post('/video/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return response.data;
  },

  async generateCoaching(data: { niche: string; analysis_id?: string; job_id?: string }) {
    const response = await api.post('/coaching/generate', data);
    return response.data;
  },

  async fetchViralResearch(analysisId: string) {
    const response = await api.post('/viral-research', { analysis_id: analysisId }, { timeout: 120000 });
    return response.data;
  },

  async askQuestion(question: string, niche: string) {
    const response = await api.post('/chat/ask', { question, niche });
    return response.data;
  },

  // ── TRENDING IDEAS ──
  async getTrendingIdeas(niche: string) {
    const response = await api.post('/trending/ideas', { niche }, { timeout: 3600000 });
    return response.data;
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const checkBackendStatus = async (): Promise<{
  connected: boolean;
  healthy: boolean;
  message: string;
}> => {
  try {
    const health = await ApiService.healthCheck();
    return {
      connected: true,
      healthy: health.status === 'healthy',
      message: health.genai_available ? 'AI ready' : 'AI unavailable',
    };
  } catch (error: any) {
    return {
      connected: false,
      healthy: false,
      message: error.userMessage || 'Cannot connect to backend',
    };
  }
};

export const getApiUrl = (): string => API_BASE_URL;
export const isDevelopment = (): boolean => __DEV__;

// ============================================
// STORAGE SERVICE
// ============================================
export const StorageService = {

  async saveJobId(jobId: string | undefined) {
    if (jobId) await AsyncStorage.setItem('current_job_id', jobId);
  },
  async getJobId() { return AsyncStorage.getItem('current_job_id'); },

  async saveNiche(niche: string | undefined) {
    if (niche) await AsyncStorage.setItem('current_niche', niche);
  },
  async getNiche() { return AsyncStorage.getItem('current_niche'); },

  async saveAnalysisId(analysisId: string | undefined) {
    if (analysisId) await AsyncStorage.setItem('analysis_id', analysisId);
  },
  async getAnalysisId() { return AsyncStorage.getItem('analysis_id'); },

  async saveConversation(conversation: any[]) {
    if (conversation?.length > 0) {
      await AsyncStorage.setItem('conversation', JSON.stringify(conversation));
    }
  },
  async getConversation() {
    const data = await AsyncStorage.getItem('conversation');
    return data ? JSON.parse(data) : [];
  },

  async clearAll() {
    // Preserve device_id across clears — it's the abuse-prevention anchor
    const deviceId = await AsyncStorage.getItem('device_id');
    await AsyncStorage.clear();
    if (deviceId) await AsyncStorage.setItem('device_id', deviceId);
  },

  /** Clear all user-specific keys on logout (preserves device_id) */
  async logoutClear() {
    await AsyncStorage.multiRemove([
      'auth_token', 'user_id', 'user_contact', 'user_tier',
      'tiktok_access_token', 'tiktok_refresh_token',
      'current_niche', 'current_job_id', 'analysis_id', 'conversation',
    ]);
  },

  async saveTikTokToken(token: string, refresh?: string) {
    await AsyncStorage.setItem('tiktok_access_token', token);
    if (refresh) await AsyncStorage.setItem('tiktok_refresh_token', refresh);
  },
  async getTikTokToken() { return AsyncStorage.getItem('tiktok_access_token'); },
  async clearTikTokToken() {
    await AsyncStorage.multiRemove(['tiktok_access_token', 'tiktok_refresh_token']);
  },
};

export default ApiService;
