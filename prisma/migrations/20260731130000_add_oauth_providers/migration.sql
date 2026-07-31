-- Новые способы входа (OAuth). Идемпотентно: значения enum добавляются
-- только если их ещё нет. Существующие TELEGRAM/EMAIL не затрагиваются.
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'YANDEX';
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'GOOGLE';
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'APPLE';
