import { cn } from '@/lib/utils';
import { Platform, TextInput, type TextInputProps } from 'react-native';

function Input({
  className,
  placeholderClassName,
  ...props
}: TextInputProps & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'border-[#e5e5e5] dark:border-[#262626] bg-white dark:bg-[#262626]/30 text-[#0a0a0a] dark:text-[#fafafa] flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
          ),
        Platform.select({
          web: cn(
            'placeholder:text-[#737373] dark:placeholder:text-[#a3a3a3] selection:bg-[#171717] dark:selection:bg-[#fafafa] selection:text-[#fafafa] dark:selection:text-[#171717] outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-[#a1a1a1] dark:focus-visible:border-[#737373] focus-visible:ring-[#a1a1a1]/50 dark:focus-visible:ring-[#737373]/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-[#ef4444]/20 dark:aria-invalid:ring-[#dc2626]/40 aria-invalid:border-[#ef4444] dark:aria-invalid:border-[#dc2626]'
          ),
          native: 'placeholder:text-[#737373]/50 dark:placeholder:text-[#a3a3a3]/50',
        }),
        className
      )}
      {...props}
    />
  );
}

export { Input };
