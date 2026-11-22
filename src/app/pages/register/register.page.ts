
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink]
})
export class RegisterPage {

  username = '';
  email = '';
  password = '';

  // FASTAPI BACKEND URL
  private apiUrl = 'http://127.0.0.1:8000/api';

  async register() {

    // CHECK EMPTY FIELDS
    if (
      !this.username.trim() ||
      !this.email.trim() ||
      !this.password
    ) {
      alert('Pakilagyan ang lahat ng kinakailangang impormasyon.');
      return;
    }

    try {

      const response = await fetch(
        `${this.apiUrl}/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: this.username.trim(),
            email: this.email.trim(),
            password: this.password
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || 'Hindi nagtagumpay ang registration.');
        console.error('Registration response:', result);
        return;
      }

      alert(result.message || 'Matagumpay ang registration!');

    } catch (error) {

      console.error('Registration error:', error);

      alert(
        'Hindi makakonekta sa FastAPI backend. Tiyaking tumatakbo ang Uvicorn sa port 8000.'
      );

    }

  }

}
