import React from 'react';
import { APP_ICON } from '../config/brand.js';

export default function BrandIcon({ className = '', alt = '' }) {
  return (
    <img
      src={APP_ICON}
      alt={alt}
      width={192}
      height={192}
      draggable={false}
      className={`shrink-0 rounded-[22%] object-contain ${className}`}
    />
  );
}
