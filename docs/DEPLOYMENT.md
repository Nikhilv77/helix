pnpm deploy:production

Database migrations are not run by this command. Before deploying a release that changes
`prisma/schema.prisma` (including AI/ML Practice persistence), apply the committed Prisma
migrations to the intended production database through the protected database deployment
workflow. Do not point the local development migration command at production.
