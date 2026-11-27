import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { ON_ORANGE } from '@exo/shared';
import { useTheme } from './theme';

/** 52pt-tall button; `primary` is the orange call to action. */
export function Button({
  label, onPress, primary, disabled,
}: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: 18,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? t.orange : t.surface,
        borderWidth: primary ? 0 : 1.5,
        borderColor: t.line,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: primary ? ON_ORANGE : t.text, fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        placeholderTextColor={t.muted}
        {...props}
        style={{
          minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1,
          borderColor: t.line, backgroundColor: t.surface, color: t.text, fontSize: 16,
        }}
      />
    </View>
  );
}

/** A row of mutually exclusive choices (division, gender match, role). */
export function Choice<T extends string>({
  label, options, value, onChange,
}: { label: string; options: ReadonlyArray<readonly [T, string]>; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map(([v, text]) => (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ selected: v === value }}
            onPress={() => onChange(v)}
            style={{
              minHeight: 44, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center',
              backgroundColor: v === value ? t.chipBlue : t.surface, borderWidth: 1,
              borderColor: v === value ? t.link : t.line,
            }}
          >
            <Text style={{ color: t.text, fontWeight: '600' }}>{text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text accessibilityRole="alert" style={{ color: t.text, fontWeight: '700' }}>{children}</Text>;
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <ActivityIndicator color={t.link} />
    </View>
  );
}

/** Message from an openapi-fetch error body. */
export const apiError = (e: unknown) => {
  const err = (e as { error?: string })?.error;
  return err === 'validation' ? 'Check the fields and try again.' : (err ?? 'Something went wrong.');
};
