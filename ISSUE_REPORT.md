# OAuth Client Registration Bug Report

## Summary

OAuth client registration is failing with `TypeError: value.map is not a function` at the Drizzle ORM level. The Better Auth fork has an inconsistency between its schema generator and OAuth provider plugin implementation.

## Issue Details

### Error
```
TypeError: value.map is not a function
at PgArray.mapToDriverValue (drizzle-orm/pg-core/columns/common.js:183:21)
```

### Root Cause

The OAuth provider plugin is still using legacy string-based array conversion functions that are incompatible with the new native array support in the database schema.

## Files That Need Changes

### 1. `/packages/better-auth/src/plugins/oauth-provider/register.ts`

**Problem**: The `schemaToDatabase` function converts arrays to comma-separated strings:

```typescript
// ❌ CURRENT (BROKEN)
export function schemaToDatabase(input: SchemaClient): DatabaseClient {
	return {
		...input,
		allowedScopes: input.allowedScopes?.join(" "),     // Converting array to string
		contacts: input.contacts?.join(","),              // Converting array to string  
		redirectUris: input.redirectUris?.join(","),      // Converting array to string
		grantTypes: input.grantTypes?.join(","),          // Converting array to string
		responseTypes: input.responseTypes?.join(","),    // Converting array to string
	};
}
```

**Fix**: Remove the string conversion - keep arrays as arrays:

```typescript
// ✅ FIXED
export function schemaToDatabase(input: SchemaClient): DatabaseClient {
	return {
		...input,
		// Remove these lines - keep arrays as arrays:
		// allowedScopes: input.allowedScopes?.join(" "),
		// contacts: input.contacts?.join(","),
		// redirectUris: input.redirectUris?.join(","),
		// grantTypes: input.grantTypes?.join(","),
		// responseTypes: input.responseTypes?.join(","),
	};
}
```

**Problem**: The `databaseToSchema` function converts strings back to arrays:

```typescript
// ❌ CURRENT (BROKEN)
export function databaseToSchema(input: DatabaseClient): SchemaClient {
	return {
		...input,
		allowedScopes: input.allowedScopes?.split(" "),
		contacts: input.contacts?.split(","),
		redirectUris: input.redirectUris?.split(","),
		grantTypes: input.grantTypes?.split(",") as SchemaClient["grantTypes"],
		responseTypes: input.responseTypes?.split(",") as SchemaClient["responseTypes"],
	};
}
```

**Fix**: Remove the string conversion - arrays are already arrays:

```typescript
// ✅ FIXED
export function databaseToSchema(input: DatabaseClient): SchemaClient {
	return {
		...input,
		// Remove these lines - arrays are already arrays:
		// allowedScopes: input.allowedScopes?.split(" "),
		// contacts: input.contacts?.split(","),
		// redirectUris: input.redirectUris?.split(","),
		// grantTypes: input.grantTypes?.split(",") as SchemaClient["grantTypes"],
		// responseTypes: input.responseTypes?.split(",") as SchemaClient["responseTypes"],
	};
}
```

### 2. Update DatabaseClient Interface

**Problem**: The `DatabaseClient` interface overrides array fields with string types:

```typescript
// ❌ CURRENT (BROKEN)
export interface DatabaseClient
	extends Omit<
		SchemaClient,
		| "allowedScopes"
		| "contacts"
		| "redirectUris"
		| "grantTypes"
		| "responseTypes"
	> {
	allowedScopes?: string;     // ❌ Should be string[]
	contacts?: string;          // ❌ Should be string[]
	redirectUris?: string;      // ❌ Should be string[]
	grantTypes?: string;        // ❌ Should be string[]
	responseTypes?: string;     // ❌ Should be string[]
}
```

**Fix**: Remove the field overrides and use the array fields directly:

```typescript
// ✅ FIXED
export interface DatabaseClient extends SchemaClient {
	// Remove these overrides - use the array fields directly from SchemaClient
}
```

## Why This Happened

The comments in the code reveal this was a known transition:

```typescript
// TODO: Easily removable when native `string[]` is used
```

The Better Auth team was transitioning from comma-separated strings to native database arrays, but the OAuth provider plugin wasn't fully updated to complete this transition.

## What's Working Correctly

1. **Schema Definition**: The OAuth provider schema correctly defines array fields as `string[]`
2. **CLI Generation**: The CLI correctly generates Drizzle schema with native arrays using `.array()`
3. **Database Schema**: PostgreSQL tables are correctly defined with `text[]` columns
4. **Request Processing**: The `oauthToSchema` function correctly preserves arrays

## What's Broken

1. **Database Conversion**: The `schemaToDatabase` function converts arrays to strings
2. **Type Definitions**: The `DatabaseClient` interface overrides array types with string types
3. **Data Flow**: Arrays are converted to strings before database insertion, causing Drizzle ORM errors

## Error Flow

1. **Input**: Valid OAuth registration request with arrays
2. **Transform**: `oauthToSchema()` correctly preserves arrays ✅
3. **Database Conversion**: `schemaToDatabase()` incorrectly converts arrays to strings ❌
4. **Database Insert**: Drizzle tries to insert strings into `text[]` columns ❌
5. **Error**: `TypeError: value.map is not a function` when Drizzle tries to serialize the string as an array ❌

## Testing the Fix

After implementing the changes:

1. **Test OAuth Registration**: 
   ```bash
   npx -p mcp-remote@latest mcp-remote-client http://localhost:3000/mcp --allow-http
   ```

2. **Verify Database**: Check that arrays are stored correctly in PostgreSQL:
   ```sql
   SELECT redirect_uris, grant_types, response_types, contacts FROM oauth_client;
   ```

3. **Verify Response**: Ensure the OAuth client registration response contains proper arrays

## Related Files

- **Schema Definition**: `/packages/better-auth/src/plugins/oauth-provider/schema.ts` ✅ (Correct)
- **CLI Generation**: `/packages/cli/src/generators/drizzle.ts` ✅ (Correct)
- **Plugin Implementation**: `/packages/better-auth/src/plugins/oauth-provider/register.ts` ❌ (Needs Fix)

## Priority

**HIGH** - This is a blocking issue for OAuth client registration functionality.

## Impact

- OAuth Dynamic Client Registration (DCR) is completely broken
- Any application using OAuth client registration will fail
- The error occurs at the database adapter level, making it impossible to work around

## Solution

The fix is straightforward - remove the legacy string conversion functions and work directly with native arrays as the schema and CLI already support.
