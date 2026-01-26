import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { BlackjackStore, GameSettings } from '../../../store';

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatDividerModule,
  ],
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
})
export class SettingsDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SettingsDialogComponent>);
  private readonly store = inject(BlackjackStore);

  protected settings: GameSettings = { ...this.store.settings() };

  protected readonly deckOptions = [1, 2, 4, 6, 8];
  protected readonly blackjackPayOptions = [
    { value: 1.5, label: '3:2' },
    { value: 1.2, label: '6:5' },
    { value: 1, label: '1:1' },
  ];

  save(): void {
    const deckCountChanged = this.settings.numberOfDecks !== this.store.numberOfDecks();
    this.store.updateSettings(this.settings);

    // Reinitialize shoe if deck count changed
    if (deckCountChanged) {
      this.store.initializeShoe(this.settings.numberOfDecks);
    }

    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  resetDefaults(): void {
    this.store.resetSettings();
    this.settings = { ...this.store.settings() };
  }
}
