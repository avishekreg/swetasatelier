import React from 'react';
import { cn } from '../lib/utils';

interface DesignImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string;
  watermarkClassName?: string;
}

const DesignImage = ({
  alt,
  className,
  containerClassName,
  watermarkClassName,
  ...props
}: DesignImageProps) => {
  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      <img alt={alt} className={className} {...props} />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute bottom-3 right-3 z-10 opacity-[0.085] mix-blend-soft-light sm:bottom-4 sm:right-4',
          watermarkClassName
        )}
      >
        <img
          src="/images/swetas-atelier-mark.png"
          alt=""
          className="w-16 rounded-full sm:w-20 md:w-24"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default DesignImage;
