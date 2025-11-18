# MANDATORY RULES - Read Before Every Response

## ⛔ BLOCKING RULES (NEVER VIOLATE)

### Package Management
- ❌ **NEVER** use `npm` to install anything - project uses **Yarn**
- ❌ **NEVER** add packages without checking cross-platform support first
- ✅ **ALWAYS** use `yarn add` or `yarn remove` for package management
- ✅ **ALWAYS** verify packages work on Web, Android, AND iOS before installing
- ✅ **ALWAYS** search online/check documentation to confirm cross-platform compatibility

### Database
- ❌ **NEVER** suggest or add `react-native-sqlite-storage`
- ❌ **NEVER** suggest or add `drizzle-orm` or `drizzle-kit`
- ✅ **ALWAYS** use `expo-sqlite` for database operations
- ✅ **ALWAYS** use the client from `db/client.ts`

### Code Changes
- ❌ **NEVER** modify files without reading them first
- ✅ **ALWAYS** use `Read` tool before `Write` or `Edit`
- ✅ **ALWAYS** check existing patterns before suggesting new ones

### Others
- ❌ **NEVER** never kill nodejs. kill only whatever port/server you need/want to kill
