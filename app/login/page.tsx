import { create } from "domain";
import Login from "./Login";
import { createSupabaseServerClient } from "@/lib/supabase/sclient";

export default async function LoginPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return <Login user={null} />;
}