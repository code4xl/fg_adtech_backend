# 🚀 Development & Seeding Guide

## 🐳 Docker for Development

### Start All Services

```bash
docker compose -f docker-compose.dev.yml up -d
```

### View Logs from All Services

```bash
docker compose -f docker-compose.dev.yml logs -f
```

### View Logs from a Specific Service

```bash
docker compose -f docker-compose.dev.yml logs -f api
```

---

## 🌱 Prisma Seeding Guide

### Seeder Command Summary

| Command            | Purpose                         | When to Use                     | Example                                            |
| ------------------ | ------------------------------- | ------------------------------- | -------------------------------------------------- |
| `pnpm seed`        | Seeds all modules               | Initial setup or full re-seed   | `pnpm seed`                                        |
| `pnpm seed:clean`  | Cleans & then seeds all modules | Full reset with fresh data      | `pnpm seed:clean`                                  |
| `pnpm db:clean`    | Cleans all data only            | Remove all data without seeding | `pnpm db:clean`                                    |
| `pnpm seed:module` | Seeds a specific module         | Targeted seeding                | `pnpm seed:module --module=Campaign --clean=false` |
| `pnpm seed:info`   | View seeder info & order        | Understand dependencies         | `pnpm seed:info`                                   |

---

### 🔁 Advanced: Seed Specific Module

```bash
pnpm seed:module --module=ModuleName [--clean=true|false]
```

#### Examples:

- Clean and seed `Publisher` module:
  ```bash
  pnpm seed:module --module=Publisher
  ```
- Seed `Campaign` without cleaning:
  ```bash
  pnpm seed:module --module=Campaign --clean=false
  ```

### ✅ Available Modules

- `Admin`
- `Advertiser`
- `Publisher`
- `ContentCategory`
- `AdInventory`
- `Campaign`
- `Creative`
- `CampaignInventory`
- `InventoryTargetingRule`
- `CampaignTargetingRule`
- `Client`
- `FloorPrice`

---

### 📌 Notes

- All commands use `.env.development` by default.
- `--module` value is **case-sensitive**.
- Dependency system ensures modules are seeded in the correct order.
- `seed:module` will **clean by default** unless `--clean=false` is specified.
