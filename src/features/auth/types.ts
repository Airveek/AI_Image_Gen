export type AuthActionState = {
  ok: boolean;
  message: string;
};

export type AuthAction = (
  previousState: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

export const initialAuthActionState: AuthActionState = {
  ok: false,
  message: "",
};
