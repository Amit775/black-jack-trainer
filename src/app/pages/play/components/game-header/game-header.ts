import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-game-header',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './game-header.html',
  styleUrl: './game-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameHeaderComponent {
  /** Current player balance */
  readonly balance = input.required<number>();

  /** Emitted when settings button is clicked */
  readonly settingsClicked = output<void>();

  protected onSettingsClick(): void {
    this.settingsClicked.emit();
  }
}
