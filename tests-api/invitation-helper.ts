import { expect, type APIRequestContext } from "@playwright/test";
export async function invitationLink(
  request: APIRequestContext,
  email: string,
) {
  const response = await request.get(
    `http://127.0.0.1:3030/messages?${new URLSearchParams({ to: email })}`,
  );
  expect(response.ok()).toBeTruthy();
  const messages: { text?: string }[] = await response.json();
  const message = messages.filter((m) => m.text?.includes("#token=")).at(-1);
  const link = message?.text?.match(/https?:\/\/[^\s]+/)?.[0];
  expect(link).toBeTruthy();
  return link!;
}
export async function acceptInvitation(
  request: APIRequestContext,
  email: string,
  password: string,
  phone = "11988888888",
) {
  const link = await invitationLink(request, email);
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get("token");
  const response = await request.post(
    `${process.env.API_URL}/v1/auth/staff-invitations/accept`,
    { data: { token, password, phone } },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}
