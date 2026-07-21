"use client";

import { type Position, type Profile, positionSchema, profileSchema } from "@yca/shared";

import { useStoredState } from "@/lib/storage";

import { Dashboard } from "./dashboard";
import { Onboarding } from "./onboarding";

const nullableProfile = profileSchema.nullable();
const nullablePosition = positionSchema.nullable();

/**
 * 앱 본체. Next 페이지와 단일 HTML 목업이 이 컴포넌트를 함께 쓴다.
 */
export function App() {
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
