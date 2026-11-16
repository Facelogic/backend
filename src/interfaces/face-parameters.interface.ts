// Numeric parameters of "FaceParameters" (NUMERIC(12,4)): every one is required on create.
export const FACE_PARAMETERS_NUMERIC_FIELDS = [
    'recongnitionMinimumSimilarityStudent',
    'recongnitionMinimalLeadStudent',
    'recognitionConsecutiveMatchStudent',
    'recongnitionMinimumAntiFraudStudent',
    'recongnitionMinimumSimilarityStaff',
    'recongnitionMinimalLeadStaff',
    'recognitionConsecutiveMatchStaff',
    'recongnitionMinimumAntiFraudStaff',
    'enrollHeadOn',
    'enrollMinimalLateral',
    'enrollMaximumLateral',
    'learningTemplatePerPerson',
    'learningMinimumConfidence',
    'learningAdvantageOnSecondPlace',
    'learningMinimumSimilarityThreePoses',
    'learningMaximumSimilarityTemplates',
    'learningMinimumAntiFraud',
    'learningMaximumHeadRotation',
    'learningMinimumFaceSize',
    'learningFrequencyPerPerson',
] as const;

// Boolean parameters: optional, default true.
export const FACE_PARAMETERS_BOOLEAN_FIELDS = ['autoLearning', 'learOnlyPersonnelRecognitions'] as const;

export type FaceParametersNumericField = (typeof FACE_PARAMETERS_NUMERIC_FIELDS)[number];
export type FaceParametersBooleanField = (typeof FACE_PARAMETERS_BOOLEAN_FIELDS)[number];

// Body of POST /api/face-parameters (all numeric fields required) and
// PUT /api/face-parameters/:version (only the fields sent are changed).
export type FaceParametersInput = Partial<Record<FaceParametersNumericField | FaceParametersBooleanField, unknown>>;

// GET /api/face-parameters (latest version) and GET /api/face-parameters/:version.
export type FaceParametersItem = Record<FaceParametersNumericField, number> &
    Record<FaceParametersBooleanField, boolean> & {
        version: number;
    };
