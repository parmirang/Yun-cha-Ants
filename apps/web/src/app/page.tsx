"use client";

import { type Position, type Profile, positionSchema, profileSchema } from "@yca/shared";

import { Dashboard } from "@/components/dashboard";
import { Onboarding } from "@/components/onboarding";
import { useStoredState } from "@/lib/storage";

const nullableProfile = profileSchema.nullable();
const nullablePosition = positionSchema.nullable();

export default function Home() {
  const [profile, setProfile, profileLoaded] = useStoredState<Profile | null>(
    "yca.profile",
    nullableProfile,
    null,
  );
  const [position, setPosition, positionLoaded] = useStoredState<Position | null>(
    "yca.position",
    nullablePosition,
    null,
  );

  // localStorage를 읽기 전에 온보딩을 깜빡 보여주지 않도록 잠시 비워둔다.
  if (!profileLoaded || !positionLoaded) return <main className="min-h-dvh" />;

  if (!profile || !position) {
    return (
      <Onboarding
        onComplete={(nextProfile, nextPosition) => {
          setProfile(nextProfile);
          setPosition(nextPosition);
        }}
      />
    );
  }

  return (
    <Dashboard
      profile={profile}
      position={position}
      onPositionChange={setPosition}
      onReset={() => {
        setProfile(null);
        setPosition(null);
      }}
    />
  );
}
