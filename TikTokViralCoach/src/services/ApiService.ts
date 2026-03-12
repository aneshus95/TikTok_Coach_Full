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
// GENERIC TASK POLLING
// ============================================
async function pollTask(taskId: string, timeoutMs: number = 300000, intervalMs: number = 3000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, intervalMs));
    try {
      const { data } = await api.get(`/tasks/${taskId}/status`, { timeout: 15000 });
      if (data.state === 'SUCCEEDED') return data.result;
      if (data.state === 'FAILED') {
        const err: any = new Error(data.error_message || 'Task failed');
        err.userMessage = data.error_message || 'Something went wrong. Try again.';
        throw err;
      }
    } catch (pollErr: any) {
      if (pollErr.userMessage) throw pollErr;
      if (__DEV__) console.log('[pollTask] Retry after error:', pollErr.message);
    }
  }
  throw new Error('Task timed out. Try again.');
}

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

  /** Apply AI edit to the full video. Returns { video_url, video_filename, ...metadata } */
  async applyQuickTool(tool: string, formData: FormData) {
    // AI Edit is async — submit, start foreground service, poll in foreground + background
    if (tool === 'aiedit') {
      // Retry submission up to 3 times on connection errors (server restarts, cold starts)
      let submitRes: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          submitRes = await api.post('/tools/prompt-edit', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
            timeout: 120000,
          });
          break;
        } catch (submitErr: any) {
          if (submitErr.response) throw submitErr; // Real server error — don't retry
          if (attempt === 2) throw submitErr; // Last attempt — give up
          if (__DEV__) console.log(`[Edit] Submit attempt ${attempt + 1} failed, retrying in 3s...`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      const taskId = submitRes.data?.task_id;
      if (!taskId) throw new Error('No task_id returned');

      // Start foreground service for background polling (non-blocking, non-fatal)
      try {
        const {NotificationService} = require('./NotificationService');
        NotificationService.startVideoProcessing(taskId).catch((e: any) => {
          if (__DEV__) console.log('[Edit] Foreground service failed:', e);
        });
      } catch (e) {
        if (__DEV__) console.log('[Edit] Foreground service init failed:', e);
      }

      // Also poll in-app for immediate UI updates when app is in foreground
      const {AppState} = require('react-native');
      const maxWait = 60 * 60 * 1000;
      const start = Date.now();

      while (Date.now() - start < maxWait) {
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, 5000);
          const sub = AppState.addEventListener('change', (state: string) => {
            if (state === 'active') {
              clearTimeout(timer);
              sub.remove();
              resolve();
            }
          });
          setTimeout(() => sub.remove(), 5100);
        });

        try {
          const data = await api.get(`/tools/prompt-edit/status/${taskId}`, {timeout: 15000});
          if (data.data.state === 'SUCCEEDED') return data.data;
          if (data.data.state === 'FAILED') {
            const msg = data.data.error_message || 'AI edit failed';
            throw {message: msg, userMessage: msg};
          }
        } catch (pollErr: any) {
          if (pollErr.userMessage) throw pollErr; // Re-throw FAILED errors
          if (__DEV__) console.log('[Poll] Retry after error:', pollErr.message);
        }
      }
      throw {message: 'AI edit timed out', userMessage: 'Edit took too long. Try a shorter video.'};
    }

    throw {message: 'Unknown tool', userMessage: 'Tool not available.'};
  },

  /** Poll edit status — used by foreground service in App.tsx */
  async pollEditStatus(taskId: string) {
    const res = await api.get(`/tools/prompt-edit/status/${taskId}`, {timeout: 15000});
    return res.data;
  },

  /** Refine a previous AI edit based on user feedback */
  async refineEdit(parentTaskId: string, feedback: string) {
    const submitRes = await api.post('/tools/prompt-edit/refine', {
      parent_task_id: parentTaskId,
      feedback,
    }, {timeout: 30000});

    const taskId = submitRes.data?.task_id;
    if (!taskId) throw new Error('No task_id returned');

    // Poll same as applyQuickTool aiedit
    const {AppState} = require('react-native');
    const maxWait = 60 * 60 * 1000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 5000);
        const sub = AppState.addEventListener('change', (state: string) => {
          if (state === 'active') {
            clearTimeout(timer);
            sub.remove();
            resolve();
          }
        });
        setTimeout(() => sub.remove(), 5100);
      });

      try {
        const data = await api.get(`/tools/prompt-edit/status/${taskId}`, {timeout: 15000});
        if (data.data.state === 'SUCCEEDED') return data.data;
        if (data.data.state === 'FAILED') {
          const msg = data.data.error_message || 'Refinement failed';
          throw {message: msg, userMessage: msg};
        }
      } catch (pollErr: any) {
        if (pollErr.userMessage) throw pollErr;
        if (__DEV__) console.log('[Refine Poll] Retry after error:', pollErr.message);
      }
    }
    throw {message: 'Refinement timed out', userMessage: 'Refinement took too long. Try again.'};
  },

  // ──────────────────────────────────────────
  // SEGMENT EDITOR
  // ──────────────────────────────────────────

  /** Upload video for segment editor — returns video info + thumbnails */
  async editorUpload(videoUri: string, fileName: string) {
    const formData = new FormData();
    formData.append('video', {uri: videoUri, type: 'video/mp4', name: fileName} as any);
    const response = await api.post('/editor/upload', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 120000,
    });
    return response.data; // { video_filename, video_url, duration, width, height, thumbnails }
  },

  /** Submit AI edit for a video segment */
  async editorSegmentEdit(videoFilename: string, startTime: number, endTime: number, prompt: string) {
    const formData = new FormData();
    formData.append('video_filename', videoFilename);
    formData.append('start_time', String(startTime));
    formData.append('end_time', String(endTime));
    formData.append('prompt', prompt);
    const response = await api.post('/editor/segment-edit', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 120000,
    });
    return response.data; // { task_id, state, start_time, end_time, segment_filename }
  },

  /** Poll segment edit status */
  async editorPollSegment(taskId: string) {
    const res = await api.get(`/editor/segment-edit/status/${taskId}`, {timeout: 15000});
    return res.data; // { task_id, state, video_url?, video_filename?, error_message? }
  },

  /** Transcribe video audio for auto captions */
  async editorTranscribe(videoFilename: string) {
    const formData = new FormData();
    formData.append('video_filename', videoFilename);
    const response = await api.post('/editor/transcribe', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 180000,
    });
    return response.data; // { words: [{word, start_time, end_time}] }
  },

  /** Stitch segments into final exported video */
  async editorStitch(
    originalFilename: string,
    segments: Array<{type: string; start_time: number; end_time: number; edited_filename?: string; speed?: number}>,
    filter?: string,
    captions?: {enabled: boolean; words: any[]; timing_mode: string; font_style: string; animation: string},
  ) {
    const response = await api.post('/editor/stitch', {
      original_filename: originalFilename,
      segments,
      filter,
      captions,
    }, {timeout: 300000});
    return response.data; // { video_url, video_filename }
  },

  /** Upload image for multi-file Make Viral */
  async editorUploadImage(imageUri: string, fileName: string) {
    const formData = new FormData();
    formData.append('image', {uri: imageUri, type: 'image/jpeg', name: fileName} as any);
    const response = await api.post('/editor/upload-image', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 60000,
    });
    return response.data; // { filename, url, width, height, type }
  },

  /** Upload audio file for audio-aware Make Viral */
  async editorUploadAudio(audioUri: string, fileName: string) {
    const formData = new FormData();
    formData.append('audio', {uri: audioUri, type: 'audio/mpeg', name: fileName} as any);
    const response = await api.post('/editor/upload-audio', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 60000,
    });
    return response.data; // { filename, url, duration }
  },

  // ──────────────────────────────────────────
  // MAKE VIRAL
  // ──────────────────────────────────────────

  /** Get available niches with scraped playbooks */
  async editorAvailableNiches() {
    const res = await api.get('/editor/available-niches', {timeout: 10000});
    return res.data; // { niches: string[] }
  },

  /** Start Make Viral pipeline — single video or multi-file */
  async editorMakeViral(
    niche: string,
    prefs?: {goal?: string; audience?: string; vibe?: string; topic?: string},
    videoFilename?: string,
    files?: Array<{filename: string; type: 'video' | 'image'; duration: number}>,
  ) {
    const body: any = {niche, ...(prefs || {})};
    if (files && files.length > 0) {
      body.files = files;
    } else if (videoFilename) {
      body.video_filename = videoFilename;
    }
    const response = await api.post('/editor/make-viral', body, {timeout: 30000});
    return response.data; // { task_id, state }
  },

  /** Poll Make Viral task status */
  async editorPollViral(taskId: string) {
    const res = await api.get(`/editor/make-viral/status/${taskId}`, {timeout: 15000});
    return res.data; // { task_id, state, video_url?, edit_summary?, captions?, hooks?, error_message? }
  },

  /** Choose a hook preference and resume Make Viral pipeline */
  async editorChooseHook(taskId: string, hookChoice: string, hookDescription?: string) {
    const body: any = {task_id: taskId, hook_choice: hookChoice};
    if (hookDescription) body.hook_description = hookDescription;
    const res = await api.post('/editor/choose-hook', body, {timeout: 30000});
    return res.data; // { task_id, state }
  },

  /** Submit text overlay decisions and resume Make Viral pipeline */
  async editorTextDecisions(taskId: string, decisions: Array<{index: number; action: 'keep' | 'edit' | 'remove'; new_text?: string}>) {
    const res = await api.post('/editor/text-decisions', {task_id: taskId, decisions}, {timeout: 30000});
    return res.data; // { task_id, state }
  },

  /** Copy Style — upload reference video + user's video filename */
  async editorCopyStyle(videoFilename: string, referenceUri: string, mode: string = 'visual') {
    const formData = new FormData();
    formData.append('video_filename', videoFilename);
    formData.append('mode', mode);
    formData.append('reference', {
      uri: referenceUri,
      type: 'video/mp4',
      name: 'reference.mp4',
    } as any);
    const res = await api.post('/editor/copy-style', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 60000,
    });
    return res.data; // { task_id, state }
  },

  /** Poll Copy Style task status */
  async editorPollCopyStyle(taskId: string) {
    const res = await api.get(`/editor/copy-style/status/${taskId}`, {timeout: 15000});
    return res.data; // { task_id, state, video_url?, edit_summary?, captions?, error_message? }
  },

  /** Regenerate or tweak a Make Viral / Copy Style result */
  async regenerateEdit(parentTaskId: string, feedback?: string) {
    const body: any = {parent_task_id: parentTaskId};
    if (feedback) body.feedback = feedback;
    const res = await api.post('/editor/regenerate', body, {timeout: 30000});
    return res.data; // { task_id, state }
  },

  /** Poll regenerate/tweak task status */
  async pollRegenerateStatus(taskId: string) {
    const res = await api.get(`/editor/regenerate/status/${taskId}`, {timeout: 15000});
    return res.data; // { task_id, state, video_url?, edit_summary?, captions?, error_message? }
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

  async uploadAndAnalyzeVideo(videoUri: string, fileName: string, niche: string, scriptData?: any) {
    const formData = new FormData();
    formData.append('video', { uri: videoUri, type: 'video/mp4', name: fileName } as any);
    formData.append('niche', niche);
    if (scriptData) {
      formData.append('script_data', JSON.stringify(scriptData));
    }
    const response = await api.post('/video/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return response.data;
  },

  async pollCoachingStatus(taskId: string) {
    const res = await api.get(`/video/upload/status/${taskId}`, {timeout: 15000});
    return res.data;
  },

  async generateCoaching(data: { niche: string; analysis_id?: string; job_id?: string }) {
    const response = await api.post('/coaching/generate', data);
    return response.data;
  },

  async expandIdea(idea: string, niche: string, inspiration?: string, howToExecute?: string) {
    const { data } = await api.post('/coaching/expand-idea', {
      idea,
      niche,
      ...(inspiration ? { inspiration } : {}),
      ...(howToExecute ? { how_to_execute: howToExecute } : {}),
    }, { timeout: 30000 });
    return await pollTask(data.task_id);
  },

  async fetchViralResearch(analysisId: string) {
    const response = await api.post('/viral-research', { analysis_id: analysisId }, { timeout: 120000 });
    return response.data;
  },

  // ── FCM TOKEN ──
  async registerFCMToken(fcm_token: string, platform: string) {
    const response = await api.post('/notifications/register', { fcm_token, platform });
    return response.data;
  },

  // ── Script Writer ──────────────────────────

  async generateScript(niche: string, topic: string) {
    const { data } = await api.post('/script/generate', { niche, topic }, { timeout: 30000 });
    return await pollTask(data.task_id);
  },

  async getScriptIdeas(description: string, tone: string, format: string, audience: string = '', coachingFeedback?: any) {
    const body: any = { description, tone, format, audience };
    if (coachingFeedback) body.coaching_feedback = coachingFeedback;
    const { data } = await api.post('/script/ideas', body, { timeout: 30000 });
    return await pollTask(data.task_id);
  },

  async getScriptFromIdea(idea: any, description: string, tone: string, format: string, audience: string = '') {
    const { data } = await api.post('/script/from-idea', { idea, description, tone, format, audience }, { timeout: 30000 });
    return await pollTask(data.task_id);
  },

  async listScripts(limit: number = 20, offset: number = 0) {
    const response = await api.get('/script/list', { params: { limit, offset } });
    return response.data;
  },

  async getNicheHooks(niche: string) {
    const response = await api.get(`/hooks/${encodeURIComponent(niche)}`);
    return response.data;
  },

  // ── Content Calendar ───────────────────────

  async getCalendarEntries(startDate?: string, endDate?: string) {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/calendar', { params });
    return response.data;
  },

  async createCalendarEntry(entry: {
    entry_date: string;
    topic?: string;
    niche?: string;
    status?: string;
    script_id?: string;
    notes?: string;
    reminder_time?: string;
  }) {
    const response = await api.post('/calendar', entry);
    return response.data;
  },

  async updateCalendarEntry(id: string, fields: Record<string, any>) {
    const response = await api.put(`/calendar/${id}`, fields);
    return response.data;
  },

  async deleteCalendarEntry(id: string) {
    const response = await api.delete(`/calendar/${id}`);
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
