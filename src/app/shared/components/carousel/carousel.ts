import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  contentChildren,
  TemplateRef,
  Directive,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Directive to mark carousel item templates.
 * Usage: <ng-template carouselItem>...</ng-template>
 */
@Directive({
  selector: '[carouselItem]',
  standalone: true,
})
export class CarouselItemDirective {
  constructor(public template: TemplateRef<unknown>) {}
}

/**
 * Represents data for a carousel indicator dot.
 */
export interface CarouselIndicator {
  value?: string; // Hand value to display (e.g., "17", "21")
  state: 'inactive' | 'has-cards' | 'playing' | 'result-win' | 'result-lose' | 'result-push' | 'result-blackjack';
}

/**
 * Generic carousel component with content projection.
 * Displays one item at a time with navigation arrows and indicator dots.
 */
@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarouselComponent {
  /** The currently active index */
  readonly activeIndex = input<number>(0);

  /** Indicator data for each item */
  readonly indicators = input<CarouselIndicator[]>([]);

  /** Emitted when the active index changes */
  readonly activeIndexChange = output<number>();

  /** Query all projected carousel item templates */
  readonly items = contentChildren(CarouselItemDirective);

  /** Total number of items */
  protected readonly itemCount = computed(() => this.items().length);

  /** Whether we can navigate in each direction */
  protected readonly canGoPrev = computed(() => this.activeIndex() > 0);
  protected readonly canGoNext = computed(() => this.activeIndex() < this.itemCount() - 1);

  /** Get the current item template */
  protected readonly currentItem = computed(() => {
    const allItems = this.items();
    const index = this.activeIndex();
    if (index >= 0 && index < allItems.length) {
      return allItems[index];
    }
    return null;
  });

  /** Navigate to previous item */
  protected navigatePrev(): void {
    if (this.canGoPrev()) {
      this.activeIndexChange.emit(this.activeIndex() - 1);
    }
  }

  /** Navigate to next item */
  protected navigateNext(): void {
    if (this.canGoNext()) {
      this.activeIndexChange.emit(this.activeIndex() + 1);
    }
  }

  /** Navigate to a specific item */
  protected navigateTo(index: number): void {
    if (index >= 0 && index < this.itemCount()) {
      this.activeIndexChange.emit(index);
    }
  }

  /** Get indicator class based on state */
  protected getIndicatorClass(indicator: CarouselIndicator | undefined, index: number): string {
    const classes: string[] = [];

    if (index === this.activeIndex()) {
      classes.push('active');
    }

    if (indicator) {
      classes.push(indicator.state);
    }

    return classes.join(' ');
  }
}
