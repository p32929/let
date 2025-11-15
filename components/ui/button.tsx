import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Platform, Pressable } from 'react-native';

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-md shadow-none',
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-[#171717] dark:bg-[#fafafa] active:bg-[#171717]/90 dark:active:bg-[#fafafa]/90 shadow-sm shadow-black/5',
          Platform.select({ web: 'hover:bg-[#171717]/90 dark:hover:bg-[#fafafa]/90' })
        ),
        destructive: cn(
          'bg-[#ef4444] dark:bg-[#dc2626] active:bg-[#ef4444]/90 dark:active:bg-[#dc2626]/90 shadow-sm shadow-black/5',
          Platform.select({
            web: 'hover:bg-[#ef4444]/90 dark:hover:bg-[#dc2626]/90',
          })
        ),
        outline: cn(
          'border-[#e5e5e5] dark:border-[#262626] bg-white dark:bg-[#0a0a0a] active:bg-[#f5f5f5] dark:active:bg-[#262626] border shadow-sm shadow-black/5',
          Platform.select({
            web: 'hover:bg-[#f5f5f5] dark:hover:bg-[#262626]',
          })
        ),
        secondary: cn(
          'bg-[#f5f5f5] dark:bg-[#262626] active:bg-[#f5f5f5]/80 dark:active:bg-[#262626]/80 shadow-sm shadow-black/5',
          Platform.select({ web: 'hover:bg-[#f5f5f5]/80 dark:hover:bg-[#262626]/80' })
        ),
        ghost: cn(
          'active:bg-[#f5f5f5] dark:active:bg-[#262626]',
          Platform.select({ web: 'hover:bg-[#f5f5f5] dark:hover:bg-[#262626]' })
        ),
        link: '',
      },
      size: {
        default: cn('h-10 px-4 py-2 sm:h-9', Platform.select({ web: 'has-[>svg]:px-3' })),
        sm: cn('h-9 gap-1.5 rounded-md px-3 sm:h-8', Platform.select({ web: 'has-[>svg]:px-2.5' })),
        lg: cn('h-11 rounded-md px-6 sm:h-10', Platform.select({ web: 'has-[>svg]:px-4' })),
        icon: 'h-10 w-10 sm:h-9 sm:w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva(
  cn(
    'text-foreground text-sm font-medium',
    Platform.select({ web: 'pointer-events-none transition-colors' })
  ),
  {
    variants: {
      variant: {
        default: 'text-[#fafafa] dark:text-[#171717]',
        destructive: 'text-white',
        outline: cn(
          'text-[#0a0a0a] dark:text-[#fafafa] group-active:text-[#171717] dark:group-active:text-[#fafafa]',
          Platform.select({ web: 'group-hover:text-[#171717] dark:group-hover:text-[#fafafa]' })
        ),
        secondary: 'text-[#171717] dark:text-[#fafafa]',
        ghost: 'text-[#0a0a0a] dark:text-[#fafafa] group-active:text-[#171717] dark:group-active:text-[#fafafa]',
        link: cn(
          'text-[#171717] dark:text-[#fafafa] group-active:underline',
          Platform.select({ web: 'underline-offset-4 hover:underline group-hover:underline' })
        ),
      },
      size: {
        default: '',
        sm: '',
        lg: '',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        className={cn(props.disabled && 'opacity-50', buttonVariants({ variant, size }), className)}
        role="button"
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
