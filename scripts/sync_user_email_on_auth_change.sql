-- auth.users の email が変更されたとき、public.users の email を同期するトリガー。
-- Supabase Auth の updateUser({ email }) は確認メールを送り、ユーザーがリンクを
-- クリックして確認するまで auth.users.email は変わらない。確認完了時にこのトリガーが
-- 発火し、Auth と Prisma の整合性を保つ。
--
-- 実行方法: Supabase Dashboard > SQL Editor でこのファイルの内容を実行する。
-- Prisma マイグレーションには含めない（シャドウDB に auth スキーマがないため）。
CREATE OR REPLACE FUNCTION public.sync_user_email_on_auth_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.users
    SET email = NEW.email, updated_at = NOW()
    WHERE auth_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email_on_auth_change();
