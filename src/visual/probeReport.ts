export interface ProbeMetrics {
  /** Fração do frame sem geometria (céu ou exterior vazio). */
  voidRatio: number;
  /** Fração do avatar que chega à tela. */
  avatarVisibility: number;
  /** Fração do frame que o avatar ocuparia sem oclusão. */
  avatarScreenShare: number;
  /** Altura do ponto mais baixo do modelo acima do chão, em tiles. */
  groundGap: number;
  /** Quantidade de assets que o LoadingManager reportou como falha. */
  failedAssets: number;
}

export interface ProbeReport {
  scenario: string;
  metrics: ProbeMetrics;
  /** URLs por trás de `metrics.failedAssets`: asset não staged, não mapeado ou corrompido. */
  failedAssetUrls: string[];
}

export type ProbeOutcome = { status: 'ready'; report: ProbeReport } | { status: 'failed'; error: string };

declare global {
  interface Window { __visualProbe?: ProbeOutcome }
}
