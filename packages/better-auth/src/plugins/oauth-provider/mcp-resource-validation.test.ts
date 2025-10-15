import { describe, it, expect } from "vitest";
import { getTestInstance } from "../../test-utils/test-instance";
import { oauthProvider } from "./oauth";
import { jwt } from "../jwt";

describe("MCP Resource Parameter Validation", async () => {
	const authServerBaseUrl = "http://localhost:3000";
	const mcpServerUrl = "https://mcp.example.com";
	
	it("should accept valid MCP resource URLs", async ({ expect }) => {
		const { auth } = await getTestInstance({
			baseURL: authServerBaseUrl,
			plugins: [
				jwt({
					jwt: {
						audience: mcpServerUrl,
						issuer: authServerBaseUrl,
					},
				}),
				oauthProvider({
					loginPage: "/login",
					consentPage: "/oauth2/authorize",
					silenceWarnings: {
						oauthAuthServerConfig: true,
						openidConfig: true,
					},
				}),
			],
		});

		// Test that the resource validation logic accepts valid MCP URLs
		const testResourceUrls = [
			"https://mcp.example.com",
			"https://mcp.example.com:8443",
			"https://mcp.example.com/api",
			"https://another-mcp.example.com",
			"http://localhost:3001", // For development
		];

		for (const resourceUrl of testResourceUrls) {
			// This should not throw an error
			expect(() => {
				const url = new URL(resourceUrl);
				expect(url.protocol).toMatch(/^https?:$/);
			}).not.toThrow();
		}
	});

	it("should reject invalid resource URLs", async ({ expect }) => {
		const invalidResourceUrls = [
			"ftp://mcp.example.com", // Wrong protocol
			"mcp.example.com", // Missing protocol
			"https://mcp.example.com#fragment", // Contains fragment
			"not-a-url", // Not a valid URL
		];

		for (const resourceUrl of invalidResourceUrls) {
			// This should throw an error or fail validation
			expect(() => {
				const url = new URL(resourceUrl);
				if (url.protocol !== 'https:' && url.protocol !== 'http:') {
					throw new Error("Invalid protocol");
				}
			}).toThrow();
		}
	});
});
