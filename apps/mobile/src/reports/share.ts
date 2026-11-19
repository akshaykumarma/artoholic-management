import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ApiClient, ReportFilters, ReportId } from '@artoholic/shared';
import { API_URL, APP_VERSION, PLATFORM } from '../config';
import { tokenStore } from '../auth/token';

/** Generates the .xlsx on the server, downloads it with the session and opens the share sheet (009 FR-008). */
export async function shareReport(api: ApiClient, reportId: ReportId, filters: ReportFilters, fileName: string): Promise<string> {
  const { runId } = await api.post<{ runId: string }>(`/api/v1/reports/${reportId}/export`, { filters });
  const target = `${FileSystem.cacheDirectory ?? ''}${fileName.replace(/[^\w.-]+/g, '-')}.xlsx`;
  const token = await tokenStore.get();
  const res = await FileSystem.downloadAsync(`${API_URL}/api/v1/reports/runs/${runId}/download`, target, {
    headers: { authorization: `Bearer ${token ?? ''}`, 'x-client-platform': PLATFORM, 'x-client-version': APP_VERSION }
  });
  if (res.status !== 200) throw new Error(`Download failed (${res.status})`);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(res.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return res.uri;
}
