import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ShoeState, Card } from '../../../../shared/models';

@Component({
  selector: 'app-table-accessories',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './table-accessories.html',
  styleUrl: './table-accessories.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableAccessoriesComponent {
  /** Current shoe state */
  readonly shoeState = input.required<ShoeState>();

  /** Number of cards remaining in shoe */
  readonly cardsInShoe = input.required<number>();

  /** Cards in discard tray */
  readonly discardTray = input.required<Card[]>();

  protected readonly discardCount = computed(() => this.discardTray().length);
  protected readonly hasDiscards = computed(() => this.discardCount() > 0);
  protected readonly shuffleNeeded = computed(() => this.shoeState().shuffleNeeded);

  protected readonly shoeCardLayers = computed(() => {
    const state = this.shoeState();
    const remainingCards = state.totalCards - state.cardsDealt;
    const maxLayers = 20;
    const layers = Math.min(Math.ceil(remainingCards / (state.totalCards / maxLayers)), maxLayers);
    return Array.from({ length: layers }, (_, i) => i);
  });

  protected readonly discardLayers = computed(() => {
    const maxLayers = 15;
    const layers = Math.min(Math.ceil(this.discardCount() / 10), maxLayers);
    return Array.from({ length: layers }, (_, i) => i);
  });

  protected readonly cutCardVisualPosition = computed(() => {
    const state = this.shoeState();
    const cutCardPercent = (state.cutCardPosition / state.totalCards) * 100;
    return Math.min(cutCardPercent, 40); // Cap at 40% from bottom for visual
  });

  protected isLayerPastCutCard(layerIndex: number): boolean {
    const state = this.shoeState();
    const remainingCards = state.totalCards - state.cardsDealt;
    const cardsPerLayer = state.totalCards / 20;
    const layerCards = (20 - layerIndex) * cardsPerLayer;
    return layerCards <= state.cutCardPosition;
  }
}
